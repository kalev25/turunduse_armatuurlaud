// Impordid 2. põlvkonna funktsioonidele
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler"); // Ajastatud funktsioonide jaoks
const { defineSecret } = require("firebase-functions/params"); // Secretite jaoks
const admin = require("firebase-admin");
const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const { GoogleAuth, OAuth2Client } = require("google-auth-library");

// Initsialiseeri Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
// Kasutame teadlikult Firebase'i vaikimisi App Engine service account'i,
// et GA4 ligipääs oleks hallatav ühe selge identiteedi kaudu.
const FUNCTION_SERVICE_ACCOUNT = "turundus-deb6d@appspot.gserviceaccount.com";
const BLOG_POSTS_API_URL = "https://n8r.ee/wp-json/wp/v2/posts?per_page=100&_fields=link,date,title";
const META_FACEBOOK_PAGE_ID = "496238813554249";
const META_INSTAGRAM_BUSINESS_ACCOUNT_ID = "17841470245183441";
const META_AD_ACCOUNT_IDS = [
  "act_520726790755971",
  "act_3671964972881542",
];
const SMAILY_SUBDOMAIN = "ilukliiniknoor";
const META_APP_ID = "975993268434215";
const GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID = "111126500110775508745";
const GOOGLE_BUSINESS_PROFILE_LOCATION_ID = "12475970420024412303";
const GOOGLE_BUSINESS_PROFILE_CLIENT_ID = "812777264860-eq3qrf3stpnv2jqml1aqekffu06svuu0.apps.googleusercontent.com";
const DASHBOARD_URL = "https://turundus-deb6d.web.app";
const META_OAUTH_CALLBACK_URL = `${DASHBOARD_URL}/`;
const TIKTOK_OAUTH_CALLBACK_URL = "https://us-central1-turundus-deb6d.cloudfunctions.net/completeTikTokOAuth";
const YOUTUBE_OAUTH_CALLBACK_URL = "https://us-central1-turundus-deb6d.cloudfunctions.net/completeYouTubeOAuth";
const YOUTUBE_CHANNEL_DISPLAY_NAME = "Ilu ei anna häbeneda!";
const META_AUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "read_insights",
  "instagram_basic",
  "instagram_manage_insights",
  "business_management",
];
const YOUTUBE_AUTH_SCOPES = [
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/youtube.readonly",
];
const INSTAGRAM_STORIES_COLLECTION = "instagramStories";

// Defineeri keskkonnaparameeter (secret)
// Märkus: GA_SERVICE_ACCOUNT_KEY ei ole enam vaja defineSecret abil,
// kuna funktsioon autendib runtime service account'iga, millele on antud õigused GA4-s.
const GA_PROPERTY_ID = defineSecret("GA_PROPERTY_ID");
const META_PAGE_ACCESS_TOKEN = defineSecret("META_PAGE_ACCESS_TOKEN");
const META_ADS_ACCESS_TOKEN = defineSecret("META_ADS_ACCESS_TOKEN");
const META_APP_SECRET = defineSecret("META_APP_SECRET");
const GBP_CLIENT_SECRET = defineSecret("GBP_CLIENT_SECRET");
const GBP_REFRESH_TOKEN = defineSecret("GBP_REFRESH_TOKEN");
const SMAILY_API_USER = defineSecret("SMAILY_API_USER");
const SMAILY_API_PASSWORD = defineSecret("SMAILY_API_PASSWORD");

// Initsialiseeri Google Analytics Data Client
// Autendime end funktsiooni runtime service account'iga, millele oleme Google Analyticsis Viewer rolli andnud.
// See on turvalisem kui JSON-võtme kasutamine Cloud Functionis, sest võtit ei pea deployma.
const analyticsDataClient = new BetaAnalyticsDataClient({
  auth: new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  }),
});

/**
 * Formats month values as two-digit strings.
 * @param {number} value
 * @return {string}
 */
function padMonthValue(value) {
  return String(value).padStart(2, "0");
}

/**
 * Formats a date object into YYYY-MM-DD.
 * @param {Date} date
 * @return {string}
 */
function formatIsoDate(date) {
  return `${date.getFullYear()}-${padMonthValue(date.getMonth() + 1)}-${padMonthValue(date.getDate())}`;
}

/**
 * Extracts the pathname from a full URL.
 * @param {string} url
 * @return {string}
 */
function getPathFromUrl(url) {
  try {
    return new URL(url).pathname;
  } catch (error) {
    return url;
  }
}

/**
 * Decides whether an external referrer is specific enough to show in the blog widget.
 * @param {string} referrer
 * @return {boolean}
 */
function isMeaningfulExternalReferrer(referrer) {
  try {
    const parsedUrl = new URL(referrer);
    const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
    const path = parsedUrl.pathname || "/";
    const genericHosts = [
      "google.com",
      "google.ee",
      "facebook.com",
      "m.facebook.com",
      "l.facebook.com",
      "instagram.com",
      "l.instagram.com",
      "t.co",
      "linkedin.com",
      "lnkd.in",
      "bing.com",
      "search.yahoo.com",
    ];

    if (genericHosts.includes(hostname)) {
      return false;
    }

    if (path === "/" || path === "") {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Builds the canonical monthly date range and Firestore document id.
 * @param {Date} targetDate
 * @return {{year: number, month: number, firstDayOfMonth: string, lastDayOfMonth: string, firestoreDocId: string}}
 */
function getMonthDateRange(targetDate) {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;

  return {
    year,
    month,
    firstDayOfMonth: `${year}-${padMonthValue(month)}-01`,
    lastDayOfMonth: `${year}-${padMonthValue(month)}-${new Date(year, month, 0).getDate()}`,
    firestoreDocId: `${year}${padMonthValue(month)}01`,
  };
}

/**
 * Builds a target month from a YYYY-MM query parameter or defaults to previous month.
 * @param {string|undefined} monthParam
 * @return {Date}
 */
function resolveTargetMonth(monthParam) {
  if (monthParam) {
    if (!/^\d{4}-\d{2}$/.test(monthParam)) {
      throw new Error("month must be in YYYY-MM format.");
    }

    const [yearString, monthString] = monthParam.split("-");
    const year = parseInt(yearString, 10);
    const month = parseInt(monthString, 10);

    if (month < 1 || month > 12) {
      throw new Error("month must be between 01 and 12.");
    }

    return new Date(year, month - 1, 1);
  }

  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() - 1, 1);
}

/**
 * Builds YYYY-MM keys for all months inside a date range.
 * @param {string} startDate
 * @param {string} endDate
 * @return {Array<string>}
 */
function getMonthKeysForRange(startDate, endDate) {
  const keys = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  cursor.setDate(1);
  end.setDate(1);

  while (cursor <= end) {
    keys.push(`${cursor.getFullYear()}-${padMonthValue(cursor.getMonth() + 1)}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
}

/**
 * Builds Meta API date params where until must be later than since.
 * Meta treats until as a boundary and rejects equal since/until values.
 * @param {string} startDate
 * @param {string} endDate
 * @return {{since: string, until: string}}
 */
function getMetaApiDateParams(startDate, endDate) {
  const since = startDate;
  const untilDate = new Date(`${endDate}T00:00:00`);
  untilDate.setDate(untilDate.getDate() + 1);
  return {
    since,
    until: formatIsoDate(untilDate),
  };
}

/**
 * Returns the latest date that can be safely queried from Meta day-based metrics.
 * We keep this at yesterday to avoid unstable / future-edge metric requests.
 * @return {string}
 */
function getMetaMetricsMaxDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() - 1);
  return formatIsoDate(today);
}

/**
 * Performs an authenticated Google Business Profile API request.
 * @param {string} url
 * @param {string} accessToken
 * @return {Promise<Object>}
 */
async function fetchGoogleBusinessApi(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  const payload = await response.json();

  if (!response.ok || payload.error) {
    const message = payload && payload.error && payload.error.message ?
      payload.error.message :
      `Google Business Profile API request failed for ${url}`;
    throw new Error(message);
  }

  return payload;
}

/**
 * Exchanges a refresh token for a Google OAuth access token.
 * @return {Promise<string>}
 */
async function getGoogleBusinessAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: GOOGLE_BUSINESS_PROFILE_CLIENT_ID,
      client_secret: GBP_CLIENT_SECRET.value(),
      refresh_token: GBP_REFRESH_TOKEN.value(),
      grant_type: "refresh_token",
    }).toString(),
  });

  const payload = await response.json();
  if (!response.ok || payload.error) {
    const message = payload && payload.error_description ?
      payload.error_description :
      "Google Business Profile access token refresh failed.";
    const tokenError = new Error(message);
    tokenError.code = "GOOGLE_BUSINESS_AUTH_EXPIRED";
    throw tokenError;
  }

  return payload.access_token;
}

/**
 * Converts Google star enums to numeric values.
 * @param {string} starRating
 * @return {number|null}
 */
function getNumericStarRating(starRating) {
  const map = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return Object.prototype.hasOwnProperty.call(map, starRating) ? map[starRating] : null;
}

/**
 * Returns true when an RFC3339 timestamp falls inside the selected date range.
 * @param {string|null|undefined} timestamp
 * @param {string} startDate
 * @param {string} endDate
 * @return {boolean}
 */
function isTimestampInDateRange(timestamp, startDate, endDate) {
  if (!timestamp) {
    return false;
  }

  const isoDate = String(timestamp).slice(0, 10);
  return isoDate >= startDate && isoDate <= endDate;
}

/**
 * Fetches all Google reviews for the configured location.
 * @param {string} accessToken
 * @return {Promise<Object>}
 */
async function fetchGoogleReviews(accessToken) {
  const parent = `accounts/${GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID}/locations/${GOOGLE_BUSINESS_PROFILE_LOCATION_ID}`;
  let pageToken = null;
  const reviews = [];
  let averageRating = null;
  let totalReviewCount = null;

  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${parent}/reviews`);
    url.searchParams.set("pageSize", "50");
    url.searchParams.set("orderBy", "updateTime desc");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const payload = await fetchGoogleBusinessApi(url.toString(), accessToken);
    reviews.push(...(payload.reviews || []));

    if (averageRating == null && payload.averageRating != null) {
      averageRating = Number(payload.averageRating);
    }
    if (totalReviewCount == null && payload.totalReviewCount != null) {
      totalReviewCount = Number(payload.totalReviewCount);
    }

    pageToken = payload.nextPageToken || null;
  } while (pageToken);

  return {
    reviews,
    averageRating,
    totalReviewCount,
  };
}

/**
 * Builds query params for GBP daily metrics.
 * @param {string} startDate
 * @param {string} endDate
 * @param {Array<string>} metrics
 * @return {URLSearchParams}
 */
function buildGoogleBusinessDailyMetricsParams(startDate, endDate, metrics) {
  const params = new URLSearchParams();
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  metrics.forEach((metric) => params.append("dailyMetrics", metric));
  params.set("dailyRange.start_date.year", String(start.getFullYear()));
  params.set("dailyRange.start_date.month", String(start.getMonth() + 1));
  params.set("dailyRange.start_date.day", String(start.getDate()));
  params.set("dailyRange.end_date.year", String(end.getFullYear()));
  params.set("dailyRange.end_date.month", String(end.getMonth() + 1));
  params.set("dailyRange.end_date.day", String(end.getDate()));

  return params;
}

/**
 * Sums all values in a GBP time series.
 * @param {Object|undefined} timeSeries
 * @return {number}
 */
function sumGoogleBusinessTimeSeries(timeSeries) {
  return ((timeSeries && timeSeries.datedValues) || []).reduce((total, item) => {
    return total + (Number(item.value) || 0);
  }, 0);
}

/**
 * Builds a zero-filled GBP daily timeline from dated values.
 * @param {Object|undefined} timeSeries
 * @param {string} startDate
 * @param {string} endDate
 * @return {{granularity: string, points: Array<{label: string, value: number}>}}
 */
function buildGoogleBusinessTimeSeriesTimeline(timeSeries, startDate, endDate) {
  const valuesByDate = new Map();

  ((timeSeries && timeSeries.datedValues) || []).forEach((item) => {
    const dateValue = item.date || {};
    if (!dateValue.year || !dateValue.month || !dateValue.day) {
      return;
    }

    const dateKey = formatIsoDate(new Date(dateValue.year, dateValue.month - 1, dateValue.day));
    valuesByDate.set(dateKey, Number(item.value) || 0);
  });

  return {
    granularity: "day",
    points: buildDailyTimelinePoints(startDate, endDate).map((point) => ({
      label: point.label,
      value: valuesByDate.get(point.label) || 0,
    })),
  };
}

/**
 * Fetches Business Profile performance totals for the selected range.
 * @param {string} accessToken
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchGoogleBusinessPerformance(accessToken, startDate, endDate) {
  const metrics = [
    "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    "WEBSITE_CLICKS",
    "CALL_CLICKS",
    "BUSINESS_DIRECTION_REQUESTS",
  ];
  const params = buildGoogleBusinessDailyMetricsParams(startDate, endDate, metrics);
  const url =
    `https://businessprofileperformance.googleapis.com/v1/locations/${GOOGLE_BUSINESS_PROFILE_LOCATION_ID}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`;
  const payload = await fetchGoogleBusinessApi(url, accessToken);
  const totalsByMetric = {};
  const timelinesByMetric = {};

  (payload.multiDailyMetricTimeSeries || []).forEach((seriesGroup) => {
    (seriesGroup.dailyMetricTimeSeries || []).forEach((metricSeries) => {
      totalsByMetric[metricSeries.dailyMetric] = sumGoogleBusinessTimeSeries(metricSeries.timeSeries);
      timelinesByMetric[metricSeries.dailyMetric] = buildGoogleBusinessTimeSeriesTimeline(
        metricSeries.timeSeries,
        startDate,
        endDate,
      );
    });
  });

  const searchViews =
    (totalsByMetric.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) +
    (totalsByMetric.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0);
  const mapsViews =
    (totalsByMetric.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) +
    (totalsByMetric.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0);

  const combineTimelines = (firstTimeline, secondTimeline) => {
    const basePoints = buildDailyTimelinePoints(startDate, endDate).map((point) => ({
      label: point.label,
      value: 0,
    }));

    [firstTimeline, secondTimeline].forEach((timeline) => {
      ((timeline && timeline.points) || []).forEach((point, index) => {
        basePoints[index].value += Number(point.value) || 0;
      });
    });

    return {
      granularity: "day",
      points: basePoints,
    };
  };

  const searchTimeline = combineTimelines(
    timelinesByMetric.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH,
    timelinesByMetric.BUSINESS_IMPRESSIONS_MOBILE_SEARCH,
  );
  const mapsTimeline = combineTimelines(
    timelinesByMetric.BUSINESS_IMPRESSIONS_DESKTOP_MAPS,
    timelinesByMetric.BUSINESS_IMPRESSIONS_MOBILE_MAPS,
  );
  const emptyTimeline = {
    granularity: "day",
    points: buildDailyTimelinePoints(startDate, endDate),
  };

  return {
    profileViews: searchViews + mapsViews,
    searchViews,
    mapsViews,
    websiteClicks: totalsByMetric.WEBSITE_CLICKS || 0,
    callClicks: totalsByMetric.CALL_CLICKS || 0,
    directionRequests: totalsByMetric.BUSINESS_DIRECTION_REQUESTS || 0,
    timelines: {
      profileViews: combineTimelines(searchTimeline, mapsTimeline),
      searchViews: searchTimeline,
      mapsViews: mapsTimeline,
      websiteClicks: timelinesByMetric.WEBSITE_CLICKS || emptyTimeline,
      callClicks: timelinesByMetric.CALL_CLICKS || emptyTimeline,
      directionRequests: timelinesByMetric.BUSINESS_DIRECTION_REQUESTS || emptyTimeline,
    },
  };
}

/**
 * Builds Google review metrics for the selected range.
 * @param {Array<Object>} reviews
 * @param {string} startDate
 * @param {string} endDate
 * @return {Object}
 */
function buildGoogleReviewRangeSummary(reviews, startDate, endDate) {
  const periodReviews = reviews.filter((review) => isTimestampInDateRange(review.createTime, startDate, endDate));
  const numericRatings = periodReviews
    .map((review) => getNumericStarRating(review.starRating))
    .filter((value) => value != null);
  const averageRating = numericRatings.length > 0 ?
    numericRatings.reduce((sum, value) => sum + value, 0) / numericRatings.length :
    null;

  return {
    newReviews: periodReviews.length,
    averageRating,
    latestReviews: periodReviews.map((review) => ({
      reviewId: review.reviewId,
      reviewerName: review.reviewer && review.reviewer.displayName ? review.reviewer.displayName : "Anonüümne",
      starRating: getNumericStarRating(review.starRating),
      comment: review.comment || "",
      createTime: review.createTime || null,
      updateTime: review.updateTime || null,
      replyComment: review.reviewReply && review.reviewReply.comment ? review.reviewReply.comment : "",
      replyUpdateTime: review.reviewReply && review.reviewReply.updateTime ? review.reviewReply.updateTime : null,
    })),
  };
}

/**
 * Builds a daily timeline of Google review counts for the selected range.
 * @param {Array<Object>} reviews
 * @param {string} startDate
 * @param {string} endDate
 * @return {{granularity: string, points: Array<{label: string, value: number}>}}
 */
function buildGoogleReviewsTimeline(reviews, startDate, endDate) {
  const countsByDate = new Map();
  reviews.forEach((review) => {
    if (!isTimestampInDateRange(review.createTime, startDate, endDate)) {
      return;
    }

    const dateKey = String(review.createTime || "").slice(0, 10);
    countsByDate.set(dateKey, (countsByDate.get(dateKey) || 0) + 1);
  });

  return {
    granularity: "day",
    points: buildDailyTimelinePoints(startDate, endDate).map((point) => ({
      label: point.label,
      value: countsByDate.get(point.label) || 0,
    })),
  };
}

/**
 * Builds an empty daily timeline for a selected range.
 * @param {string} startDate
 * @param {string} endDate
 * @return {{granularity: string, points: Array<{label: string, value: number}>}}
 */
function buildEmptyDailyValueTimeline(startDate, endDate) {
  const points = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (cursor <= end) {
    points.push({
      label: formatIsoDate(cursor),
      value: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    granularity: "day",
    points,
  };
}

/**
 * Creates a stable key for media item aggregation.
 * @param {object} item
 * @param {string} fallbackPrefix
 * @return {string}
 */
function getMediaItemKey(item, fallbackPrefix) {
  return item.id || item.videoId || item.trackId || item.url || `${fallbackPrefix}:${item.title || item.name || "unknown"}`;
}

/**
 * Adds one media item to an aggregate map.
 * @param {Map<string, object>} aggregateMap
 * @param {object} item
 * @param {string} metricKey
 * @param {string} fallbackPrefix
 */
function addMediaItemMetric(aggregateMap, item, metricKey, fallbackPrefix) {
  const key = getMediaItemKey(item, fallbackPrefix);
  const rawMetricValue = item[metricKey] != null ? item[metricKey] : item.value;
  const currentItem = aggregateMap.get(key) || {
    id: item.id || item.videoId || item.trackId || key,
    title: item.title || item.name || "Nimetu",
    url: item.url || "",
    [metricKey]: 0,
  };

  currentItem[metricKey] += Number(rawMetricValue || 0) || 0;
  if (!currentItem.url && item.url) {
    currentItem.url = item.url;
  }
  aggregateMap.set(key, currentItem);
}

/**
 * Builds YouTube performance payload from Firestore docs.
 * @param {Array<object>} docs
 * @param {string} startDate
 * @param {string} endDate
 * @return {object}
 */
function buildMediaPerformancePayload(docs, startDate, endDate) {
  const youtubeItems = new Map();
  const youtubeTimelineByDate = new Map();

  buildEmptyDailyValueTimeline(startDate, endDate).points.forEach((point) => {
    youtubeTimelineByDate.set(point.label, 0);
  });

  docs.forEach((doc) => {
    const date = doc.date;
    const youtube = doc.youtube || {};
    const youtubeVideos = youtube.videos || [];
    const youtubeTotal = youtube.totalViews != null ?
      youtube.totalViews :
      youtubeVideos.reduce((sum, item) => {
        const value = item.views != null ? item.views : item.value;
        return sum + (Number(value || 0) || 0);
      }, 0);

    youtubeTimelineByDate.set(date, (youtubeTimelineByDate.get(date) || 0) + youtubeTotal);

    youtubeVideos.forEach((item) => addMediaItemMetric(youtubeItems, item, "views", "youtube"));
  });

  const sortByMetric = (metricKey) => (a, b) => (b[metricKey] || 0) - (a[metricKey] || 0);

  return {
    startDate,
    endDate,
    youtube: {
      videos: Array.from(youtubeItems.values()).sort(sortByMetric("views")),
      timeline: {
        granularity: "day",
        points: Array.from(youtubeTimelineByDate.entries()).map(([label, value]) => ({ label, value })),
      },
    },
  };
}

/**
 * Returns the Firestore doc used for persisted YouTube OAuth state.
 * @return {FirebaseFirestore.DocumentReference}
 */
function getYouTubeIntegrationDoc() {
  return db.collection("systemIntegrations").doc("youtube");
}

/**
 * Reads persisted YouTube OAuth state from Firestore.
 * @return {Promise<Object|null>}
 */
async function getStoredYouTubeIntegration() {
  const snapshot = await getYouTubeIntegrationDoc().get();
  return snapshot.exists ? snapshot.data() : null;
}

/**
 * Stores YouTube OAuth state in Firestore.
 * @param {Object} payload
 * @return {Promise<void>}
 */
async function saveStoredYouTubeIntegration(payload) {
  await getYouTubeIntegrationDoc().set({
    ...payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * Builds an OAuth2 client for YouTube APIs.
 * @return {OAuth2Client}
 */
function buildYouTubeOAuthClient() {
  return new OAuth2Client(
    GOOGLE_BUSINESS_PROFILE_CLIENT_ID,
    GBP_CLIENT_SECRET.value(),
    YOUTUBE_OAUTH_CALLBACK_URL,
  );
}

/**
 * Gets an access token for YouTube API calls.
 * @return {Promise<string|null>}
 */
async function getYouTubeAccessToken() {
  const storedIntegration = await getStoredYouTubeIntegration();
  if (!storedIntegration || !storedIntegration.refreshToken) {
    return null;
  }

  const oauthClient = buildYouTubeOAuthClient();
  oauthClient.setCredentials({
    refresh_token: storedIntegration.refreshToken,
  });
  const accessToken = await oauthClient.getAccessToken();
  return accessToken && accessToken.token ? accessToken.token : null;
}

/**
 * Performs an authenticated YouTube API request.
 * @param {string} url
 * @param {string} accessToken
 * @return {Promise<object>}
 */
async function fetchYouTubeApi(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new Error(
      payload &&
      payload.error &&
      payload.error.message ?
        payload.error.message :
        "YouTube API request failed.",
    );
  }

  return payload;
}

/**
 * Fetches metadata for YouTube video IDs.
 * @param {Array<string>} videoIds
 * @param {string} accessToken
 * @return {Promise<Map<string, object>>}
 */
async function fetchYouTubeVideoMetadata(videoIds, accessToken) {
  const metadataById = new Map();

  for (let index = 0; index < videoIds.length; index += 50) {
    const chunk = videoIds.slice(index, index + 50);
    if (chunk.length === 0) {
      continue;
    }

    const url = new URL("https://youtube.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", chunk.join(","));
    url.searchParams.set("maxResults", "50");
    const payload = await fetchYouTubeApi(url.toString(), accessToken);

    (payload.items || []).forEach((item) => {
      metadataById.set(item.id, {
        title: item.snippet && item.snippet.title ? item.snippet.title : item.id,
        url: `https://www.youtube.com/watch?v=${item.id}`,
      });
    });
  }

  return metadataById;
}

/**
 * Fetches YouTube Analytics top videos and daily total views.
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<object|null>}
 */
async function fetchYouTubePerformanceRange(startDate, endDate) {
  const accessToken = await getYouTubeAccessToken();
  if (!accessToken) {
    return null;
  }

  const topVideosUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  topVideosUrl.searchParams.set("ids", "channel==MINE");
  topVideosUrl.searchParams.set("startDate", startDate);
  topVideosUrl.searchParams.set("endDate", endDate);
  topVideosUrl.searchParams.set("metrics", "views");
  topVideosUrl.searchParams.set("dimensions", "video");
  topVideosUrl.searchParams.set("sort", "-views");
  topVideosUrl.searchParams.set("maxResults", "200");

  const timelineUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  timelineUrl.searchParams.set("ids", "channel==MINE");
  timelineUrl.searchParams.set("startDate", startDate);
  timelineUrl.searchParams.set("endDate", endDate);
  timelineUrl.searchParams.set("metrics", "views");
  timelineUrl.searchParams.set("dimensions", "day");
  timelineUrl.searchParams.set("sort", "day");

  const channelUrl = new URL("https://youtube.googleapis.com/youtube/v3/channels");
  channelUrl.searchParams.set("part", "snippet");
  channelUrl.searchParams.set("mine", "true");
  channelUrl.searchParams.set("maxResults", "1");

  const [topVideosPayload, timelinePayload, channelPayload] = await Promise.all([
    fetchYouTubeApi(topVideosUrl.toString(), accessToken),
    fetchYouTubeApi(timelineUrl.toString(), accessToken),
    fetchYouTubeApi(channelUrl.toString(), accessToken),
  ]);

  const videoRows = topVideosPayload.rows || [];
  const videoIds = videoRows.map((row) => row[0]).filter(Boolean);
  const metadataById = await fetchYouTubeVideoMetadata(videoIds, accessToken);
  const videos = videoRows.map((row) => {
    const videoId = row[0];
    const metadata = metadataById.get(videoId) || {};
    return {
      id: videoId,
      title: metadata.title || videoId,
      url: metadata.url || `https://www.youtube.com/watch?v=${videoId}`,
      views: Number(row[1]) || 0,
    };
  });

  const emptyTimeline = buildEmptyDailyValueTimeline(startDate, endDate);
  const viewsByDate = new Map();
  emptyTimeline.points.forEach((point) => viewsByDate.set(point.label, 0));
  (timelinePayload.rows || []).forEach((row) => {
    viewsByDate.set(row[0], Number(row[1]) || 0);
  });

  const channel = channelPayload.items && channelPayload.items[0] ?
    {
      id: channelPayload.items[0].id,
      title: channelPayload.items[0].snippet && channelPayload.items[0].snippet.title ?
        channelPayload.items[0].snippet.title :
        YOUTUBE_CHANNEL_DISPLAY_NAME,
    } :
    {
      id: "",
      title: YOUTUBE_CHANNEL_DISPLAY_NAME,
    };

  return {
    channel,
    videos,
    timeline: {
      granularity: "day",
      points: Array.from(viewsByDate.entries()).map(([label, value]) => ({ label, value })),
    },
  };
}

/**
 * Clamps a requested metric range to the last safe Meta metric day.
 * @param {string} startDate
 * @param {string} endDate
 * @return {{startDate: ?, endDate: ?, hasRange: boolean}}
 */
function getSafeMetaMetricRange(startDate, endDate) {
  const maxDate = getMetaMetricsMaxDate();
  const safeEndDate = endDate < maxDate ? endDate : maxDate;

  if (startDate > safeEndDate) {
    return {
      startDate: null,
      endDate: null,
      hasRange: false,
    };
  }

  return {
    startDate,
    endDate: safeEndDate,
    hasRange: true,
  };
}

/**
 * Splits a selected range into Meta-safe chunks where until - since <= 30 days.
 * Because Meta uses an exclusive until boundary, each chunk may cover at most 30 inclusive days.
 * @param {string} startDate
 * @param {string} endDate
 * @return {Array<{startDate: string, endDate: string}>}
 */
function getMetaApiChunksForRange(startDate, endDate) {
  const chunks = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (cursor <= end) {
    const chunkStart = new Date(cursor);
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + 29);
    if (chunkEnd > end) {
      chunkEnd.setTime(end.getTime());
    }

    chunks.push({
      startDate: formatIsoDate(chunkStart),
      endDate: formatIsoDate(chunkEnd),
    });

    cursor.setDate(cursor.getDate() + 30);
  }

  return chunks;
}

/**
 * Performs a Meta Graph API GET request.
 * @param {string} path
 * @param {Object} params
 * @param {string} accessToken
 * @return {Promise<Object>}
 */
async function fetchMetaGraph(path, params, accessToken) {
  const url = new URL(`https://graph.facebook.com/v25.0/${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString());
  const payload = await response.json();

  if (!response.ok || payload.error) {
    const message = payload && payload.error && payload.error.message ?
      payload.error.message :
      `Meta API request failed for ${path}`;
    throw new Error(message);
  }

  return payload;
}

/**
 * Fetches Meta ad spend split by publisher platform for the selected range.
 * We keep the boost split conservative until we have a reliable Marketing API discriminator.
 * @param {string} accessToken
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchMetaAdSpend(accessToken, startDate, endDate) {
  const safeMetricRange = getSafeMetaMetricRange(startDate, endDate);
  if (!safeMetricRange.hasRange) {
    return {
      boostSpend: null,
      facebookAdSpend: null,
      instagramAdSpend: null,
      totalAdSpend: null,
    };
  }

  let facebookAdSpend = 0;
  let instagramAdSpend = 0;
  let totalAdSpend = 0;
  for (const adAccountId of META_AD_ACCOUNT_IDS) {
    const payload = await fetchMetaGraph(
      `${adAccountId}/insights`,
      {
        fields: "spend",
        level: "account",
        time_increment: "all_days",
        breakdowns: "publisher_platform",
        time_range: JSON.stringify({
          since: safeMetricRange.startDate,
          until: safeMetricRange.endDate,
        }),
      },
      accessToken,
    );

    const rows = payload.data || [];
    rows.forEach((row) => {
      const spend = Number(row.spend) || 0;
      const publisherPlatform = String(row.publisher_platform || "").toLowerCase();
      totalAdSpend += spend;

      if (publisherPlatform === "facebook") {
        facebookAdSpend += spend;
      } else if (publisherPlatform === "instagram") {
        instagramAdSpend += spend;
      }
    });
  }

  return {
    boostSpend: null,
    facebookAdSpend,
    instagramAdSpend,
    totalAdSpend,
  };
}

/**
 * Extracts a numeric ad action value by action type.
 * @param {Array<Object>} actions
 * @param {string} actionType
 * @return {number}
 */
function getMetaAdActionValue(actions, actionType) {
  return (actions || []).reduce((total, action) => {
    if (action && action.action_type === actionType) {
      return total + (Number(action.value) || 0);
    }

    return total;
  }, 0);
}

/**
 * Aggregates Meta ad ranking rows by visible content item.
 * @param {Array<Object>} items
 * @return {Array<Object>}
 */
function aggregateMetaAdRankingItems(items) {
  const groupedItems = new Map();

  (items || []).forEach((item) => {
    const groupingKey = `${item.title || "item"}::${item.url || ""}`;
    const existingItem = groupedItems.get(groupingKey);

    if (!existingItem) {
      groupedItems.set(groupingKey, {
        ...item,
      });
      return;
    }

    existingItem.spend += item.spend || 0;
    existingItem.linkClicks += item.linkClicks || 0;
    existingItem.landingPageViews += item.landingPageViews || 0;
    existingItem.postLikes += item.postLikes || 0;
    existingItem.costPerClick = existingItem.linkClicks > 0 ? existingItem.spend / existingItem.linkClicks : null;
  });

  return Array.from(groupedItems.values());
}

/**
 * Builds Meta ad ranking groups for the dashboard.
 * @param {string} accessToken
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchMetaAdRankings(accessToken, startDate, endDate) {
  const safeMetricRange = getSafeMetaMetricRange(startDate, endDate);
  if (!safeMetricRange.hasRange) {
    return {
      facebookBoosts: [],
      instagramBoosts: [],
      linkClicks: [],
      totals: {
        facebookBoostSpend: null,
        instagramBoostSpend: null,
        linkClicksTotal: null,
      },
    };
  }

  const facebookBoostItems = [];
  const instagramBoostItems = [];
  const linkClickItems = [];
  let facebookBoostSpend = 0;
  let instagramBoostSpend = 0;
  let totalLinkClicks = 0;

  for (const adAccountId of META_AD_ACCOUNT_IDS) {
    const [insightsPayload, adPayload] = await Promise.all([
      fetchAllMetaItems(
        `${adAccountId}/insights`,
        {
          level: "ad",
          fields: "ad_id,ad_name,spend,actions",
          time_range: JSON.stringify({
            since: safeMetricRange.startDate,
            until: safeMetricRange.endDate,
          }),
          limit: 100,
        },
        accessToken,
      ),
      fetchAllMetaItems(
        `${adAccountId}/ads`,
        {
          fields: "id,name,creative{id,effective_object_story_id,instagram_permalink_url,object_story_spec,object_url,link_url}",
          limit: 100,
        },
        accessToken,
      ),
    ]);

    const adMetadataById = new Map((adPayload || []).map((ad) => [ad.id, ad]));

    (insightsPayload || []).forEach((insight) => {
      const adId = insight.ad_id;
      const spend = Number(insight.spend) || 0;
      const linkClicks = getMetaAdActionValue(insight.actions, "link_click");
      const landingPageViews = getMetaAdActionValue(insight.actions, "landing_page_view");
      const postLikes = getMetaAdActionValue(insight.actions, "onsite_conversion.post_net_like");
      const metadata = adMetadataById.get(adId) || {};
      const creative = metadata.creative || {};
      const permalinkUrl = creative.instagram_permalink_url || creative.object_url || creative.link_url || null;
      const title = insight.ad_name || metadata.name || adId;
      const baseItem = {
        id: adId,
        title,
        url: permalinkUrl,
        spend,
        linkClicks,
        landingPageViews,
        postLikes,
        costPerClick: linkClicks > 0 ? spend / linkClicks : null,
        accountId: adAccountId.replace(/^act_/, ""),
      };

      if (linkClicks > 0) {
        totalLinkClicks += linkClicks;
        linkClickItems.push(baseItem);
      }

      if (adAccountId === "act_520726790755971") {
        facebookBoostSpend += spend;
        facebookBoostItems.push(baseItem);
      } else if (adAccountId === "act_3671964972881542") {
        instagramBoostSpend += spend;
        instagramBoostItems.push(baseItem);
      }
    });
  }

  const sortByEffectiveness = (items, primaryKey) => items.sort((left, right) => {
    const leftPrimary = Number(left[primaryKey]) || 0;
    const rightPrimary = Number(right[primaryKey]) || 0;
    if (rightPrimary !== leftPrimary) {
      return rightPrimary - leftPrimary;
    }

    return (Number(right.spend) || 0) - (Number(left.spend) || 0);
  });

  const aggregatedFacebookBoostItems = aggregateMetaAdRankingItems(facebookBoostItems);
  const aggregatedInstagramBoostItems = aggregateMetaAdRankingItems(instagramBoostItems);
  const aggregatedLinkClickItems = aggregateMetaAdRankingItems(linkClickItems);

  sortByEffectiveness(aggregatedFacebookBoostItems, "linkClicks");
  sortByEffectiveness(aggregatedInstagramBoostItems, "linkClicks");
  sortByEffectiveness(aggregatedLinkClickItems, "linkClicks");

  return {
    facebookBoosts: aggregatedFacebookBoostItems,
    instagramBoosts: aggregatedInstagramBoostItems,
    linkClicks: aggregatedLinkClickItems,
    totals: {
      facebookBoostSpend,
      instagramBoostSpend,
      linkClicksTotal: totalLinkClicks,
    },
  };
}

/**
 * Builds a day-by-day Meta ad link click timeline.
 * @param {string} accessToken
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchMetaAdClicksTimeline(accessToken, startDate, endDate) {
  const safeMetricRange = getSafeMetaMetricRange(startDate, endDate);
  if (!safeMetricRange.hasRange) {
    return buildDailyTimeline([], startDate, endDate);
  }

  const linkClicksByDate = new Map();

  for (const adAccountId of META_AD_ACCOUNT_IDS) {
    const rows = await fetchAllMetaItems(
      `${adAccountId}/insights`,
      {
        level: "account",
        fields: "actions,date_start,date_stop",
        time_increment: 1,
        time_range: JSON.stringify({
          since: safeMetricRange.startDate,
          until: safeMetricRange.endDate,
        }),
        limit: 100,
      },
      accessToken,
    );

    (rows || []).forEach((row) => {
      const dateKey = row.date_start;
      const linkClicks = getMetaAdActionValue(row.actions, "link_click");
      if (!dateKey) {
        return;
      }

      linkClicksByDate.set(dateKey, (linkClicksByDate.get(dateKey) || 0) + linkClicks);
    });
  }

  return buildDailyTimeline(
    Array.from(linkClicksByDate.entries()).map(([label, value]) => ({ label, value })),
    startDate,
    endDate,
  );
}

/**
 * Fetches all paginated Meta Graph items for an endpoint.
 * @param {string} path
 * @param {Object} params
 * @param {string} accessToken
 * @return {Promise<Array<Object>>}
 */
async function fetchAllMetaItems(path, params, accessToken) {
  let nextUrl = null;
  let isFirstRequest = true;
  const items = [];

  while (isFirstRequest || nextUrl) {
    let payload;

    if (isFirstRequest) {
      payload = await fetchMetaGraph(path, params, accessToken);
      isFirstRequest = false;
    } else {
      const response = await fetch(nextUrl);
      payload = await response.json();
      if (!response.ok || payload.error) {
        const message = payload && payload.error && payload.error.message ?
          payload.error.message :
          `Meta API pagination failed for ${path}`;
        throw new Error(message);
      }
    }

    items.push(...(payload.data || []));
    nextUrl = payload.paging && payload.paging.next ? payload.paging.next : null;
  }

  return items;
}

/**
 * Returns the Firestore doc used for persisted Meta OAuth state.
 * @return {FirebaseFirestore.DocumentReference}
 */
function getMetaIntegrationDoc() {
  return db.collection("systemIntegrations").doc("meta");
}

/**
 * Reads persisted Meta OAuth state from Firestore.
 * @return {Promise<Object|null>}
 */
async function getStoredMetaIntegration() {
  const snapshot = await getMetaIntegrationDoc().get();
  return snapshot.exists ? snapshot.data() : null;
}

/**
 * Stores refreshed Meta OAuth state in Firestore.
 * @param {Object} payload
 * @return {Promise<void>}
 */
async function saveStoredMetaIntegration(payload) {
  await getMetaIntegrationDoc().set({
    ...payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * Resolves the preferred Meta access token.
 * Firestore-stored OAuth token takes precedence over the secret fallback.
 * @return {Promise<string>}
 */
async function getMetaAccessToken() {
  const storedIntegration = await getStoredMetaIntegration();
  if (storedIntegration && storedIntegration.pageAccessToken) {
    return storedIntegration.pageAccessToken;
  }

  return META_PAGE_ACCESS_TOKEN.value();
}

/**
 * Resolves the preferred Meta Ads access token.
 * Marketing API spend reads should use the long-lived user token when available.
 * @return {Promise<string>}
 */
async function getMetaAdsAccessToken() {
  const storedIntegration = await getStoredMetaIntegration();
  if (storedIntegration && storedIntegration.longLivedUserToken) {
    return storedIntegration.longLivedUserToken;
  }

  return META_ADS_ACCESS_TOKEN.value();
}

/**
 * Sums day-based Meta insight values.
 * @param {Array<Object>} insightData
 * @param {string} metricName
 * @return {number}
 */
function sumMetaInsightMetric(insightData, metricName) {
  const metric = (insightData || []).find((item) => item.name === metricName);
  if (!metric) {
    return 0;
  }

  return (metric.values || []).reduce((total, row) => total + (Number(row.value) || 0), 0);
}

/**
 * Extracts total-value Meta insight metrics.
 * @param {Array<Object>} insightData
 * @param {string} metricName
 * @return {number}
 */
function getMetaTotalValueMetric(insightData, metricName) {
  const metric = (insightData || []).find((item) => item.name === metricName);
  return Number(metric && metric.total_value && metric.total_value.value) || 0;
}

/**
 * Sums numeric values from a day-series Meta insight metric.
 * @param {Array<Object>} insightData
 * @param {string} metricName
 * @return {number}
 */
function sumMetaSeriesMetric(insightData, metricName) {
  const metric = (insightData || []).find((item) => item.name === metricName);
  if (!metric) {
    return 0;
  }

  return (metric.values || []).reduce((total, row) => total + (Number(row.value) || 0), 0);
}

/**
 * Builds a zero-filled day timeline for the selected range.
 * @param {string} startDate
 * @param {string} endDate
 * @return {Array<Object>}
 */
function buildDailyTimelinePoints(startDate, endDate) {
  const points = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (cursor <= end) {
    points.push({
      label: formatIsoDate(cursor),
      value: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return points;
}

/**
 * Builds a normalized day timeline payload from sparse date/value rows.
 * @param {Array<{label: string, value: number}>} rows
 * @param {string} startDate
 * @param {string} endDate
 * @return {{granularity: string, points: Array<{label: string, value: number}>}}
 */
function buildDailyTimeline(rows, startDate, endDate) {
  const rowMap = new Map((rows || []).map((row) => [row.label, Number(row.value) || 0]));
  const points = buildDailyTimelinePoints(startDate, endDate).map((point) => ({
    label: point.label,
    value: rowMap.get(point.label) || 0,
  }));

  return {
    granularity: "day",
    points,
  };
}

/**
 * Fetches Instagram views timeline for the selected range.
 * @param {string} accessToken
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchInstagramViewsTimeline(accessToken, startDate, endDate) {
  const sampleDates = buildDailyTimelinePoints(startDate, endDate).map((point) => point.label);
  const safeMetricRange = getSafeMetaMetricRange(startDate, endDate);

  if (!safeMetricRange.hasRange) {
    return {
      granularity: "day",
      points: sampleDates.map((dateLabel) => ({
        label: dateLabel,
        value: 0,
      })),
    };
  }

  const points = await Promise.all(sampleDates.map(async (dateLabel) => {
    if (dateLabel > safeMetricRange.endDate) {
      return {
        label: dateLabel,
        value: 0,
      };
    }

    const singleDayParams = getMetaApiDateParams(dateLabel, dateLabel);
    const response = await fetchMetaGraph(
      `${META_INSTAGRAM_BUSINESS_ACCOUNT_ID}/insights`,
      {
        metric: "views",
        period: "day",
        metric_type: "total_value",
        since: singleDayParams.since,
        until: singleDayParams.until,
      },
      accessToken,
    );

    const metric = (response.data || []).find((item) => item.name === "views");
    return {
      label: dateLabel,
      value: Number(metric && metric.total_value && metric.total_value.value) || 0,
    };
  }));

  return {
    granularity: "day",
    points,
  };
}

/**
 * Fetches Facebook reach timeline for the selected range.
 * @param {string} accessToken
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchFacebookReachTimeline(accessToken, startDate, endDate) {
  const points = buildDailyTimelinePoints(startDate, endDate);
  const valuesByDate = new Map();
  const safeMetricRange = getSafeMetaMetricRange(startDate, endDate);
  const metaChunks = safeMetricRange.hasRange ?
    getMetaApiChunksForRange(safeMetricRange.startDate, safeMetricRange.endDate) :
    [];

  for (const chunk of metaChunks) {
    const metaDateParams = getMetaApiDateParams(chunk.startDate, chunk.endDate);
    const response = await fetchMetaGraph(
      `${META_FACEBOOK_PAGE_ID}/insights`,
      {
        metric: "page_impressions_unique",
        period: "day",
        since: metaDateParams.since,
        until: metaDateParams.until,
      },
      accessToken,
    );

    const metric = (response.data || []).find((item) => item.name === "page_impressions_unique");
    ((metric && metric.values) || []).forEach((row) => {
      const label = row.end_time ? row.end_time.slice(0, 10) : "";
      valuesByDate.set(label, Number(row.value) || 0);
    });
  }

  return {
    granularity: "day",
    points: points.map((point) => ({
      label: point.label,
      value: valuesByDate.get(point.label) || 0,
    })),
  };
}

/**
 * Checks whether a timestamp falls inside the given YYYY-MM-DD range.
 * @param {string} timestamp
 * @param {string} startDate
 * @param {string} endDate
 * @return {boolean}
 */
function isTimestampInRange(timestamp, startDate, endDate) {
  const isoDate = timestamp ? timestamp.slice(0, 10) : "";
  return isoDate >= startDate && isoDate <= endDate;
}

/**
 * Builds a compact title for social content cards.
 * @param {string} rawText
 * @param {string} fallback
 * @return {string}
 */
function buildMetaContentTitle(rawText, fallback) {
  const normalized = String(rawText || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.length > 90 ? `${normalized.slice(0, 87)}...` : normalized;
}

/**
 * Fetches Facebook top posts ranked by interactions.
 * @param {string} accessToken
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Array<Object>>}
 */
async function fetchFacebookTopPosts(accessToken, startDate, endDate) {
  const metaDateParams = getMetaApiDateParams(startDate, endDate);
  const posts = await fetchAllMetaItems(
    `${META_FACEBOOK_PAGE_ID}/posts`,
    {
      fields: "id,message,created_time,permalink_url,shares,reactions.limit(0).summary(true),comments.limit(0).summary(true)",
      since: metaDateParams.since,
      until: metaDateParams.until,
      limit: 100,
    },
    accessToken,
  );

  const mappedPosts = posts
    .map((item) => {
      const reactions = Number(item.reactions && item.reactions.summary && item.reactions.summary.total_count) || 0;
      const comments = Number(item.comments && item.comments.summary && item.comments.summary.total_count) || 0;
      const shares = Number(item.shares && item.shares.count) || 0;
      const interactions = reactions + comments + shares;
      const dateLabel = item.created_time ? item.created_time.slice(0, 10) : "";

      return {
        id: item.id,
        title: buildMetaContentTitle(item.message, `Facebooki postitus ${dateLabel}`),
        url: item.permalink_url || `https://www.facebook.com/${item.id}`,
        publishedAt: dateLabel,
        interactions,
        reach: 0,
      };
    });

  await Promise.all(mappedPosts.map(async (item) => {
    try {
      const payload = await fetchMetaGraph(
        `${item.id}/insights`,
        { metric: "post_impressions_unique" },
        accessToken,
      );
      const values = payload.data && payload.data[0] && payload.data[0].values ? payload.data[0].values : [];
      item.reach = values.reduce((total, row) => total + (Number(row.value) || 0), 0);
    } catch (error) {
      console.warn(`Unable to read Facebook post insights for ${item.id}: ${error.message}`);
    }
  }));

  return mappedPosts
    .sort((a, b) => (b.reach || 0) - (a.reach || 0) || (b.interactions || 0) - (a.interactions || 0))
    .slice(0, 50);
}

/**
 * Fetches Instagram top posts ranked by interactions.
 * @param {string} accessToken
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Array<Object>>}
 */
async function fetchInstagramTopPosts(accessToken, startDate, endDate) {
  const mediaItems = await fetchAllMetaItems(
    `${META_INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
    {
      fields: "id,caption,timestamp,permalink,media_type,media_product_type,like_count,comments_count",
      limit: 100,
    },
    accessToken,
  );

  const mappedItems = mediaItems
    .filter((item) => {
      const mediaProductType = item.media_product_type || "";
      return mediaProductType !== "STORY" && isTimestampInRange(item.timestamp, startDate, endDate);
    })
    .map((item) => {
      const interactions = (Number(item.like_count) || 0) + (Number(item.comments_count) || 0);
      const dateLabel = item.timestamp ? item.timestamp.slice(0, 10) : "";

      return {
        id: item.id,
        title: buildMetaContentTitle(item.caption, `Instagrami sisu ${dateLabel}`),
        url: item.permalink || "#",
        publishedAt: dateLabel,
        interactions,
        views: 0,
        mediaType: item.media_type || "IMAGE",
      };
    });

  await Promise.all(mappedItems.map(async (item) => {
    try {
      const payload = await fetchMetaGraph(
        `${item.id}/insights`,
        { metric: "views" },
        accessToken,
      );
      const values = payload.data && payload.data[0] && payload.data[0].values ? payload.data[0].values : [];
      item.views = values.reduce((total, row) => total + (Number(row.value) || 0), 0);
    } catch (error) {
      console.warn(`Unable to read Instagram media insights for ${item.id}: ${error.message}`);
    }
  }));

  return mappedItems
    .sort((a, b) => (b.views || 0) - (a.views || 0) || (b.interactions || 0) - (a.interactions || 0))
    .slice(0, 50);
}

/**
 * Fetches monthly Facebook page metrics.
 * @param {string} accessToken
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchFacebookMonthMetrics(accessToken, startDate, endDate) {
  const safeMetricRange = getSafeMetaMetricRange(startDate, endDate);
  const contentDateParams = getMetaApiDateParams(startDate, endDate);
  const metaDateParams = safeMetricRange.hasRange ?
    getMetaApiDateParams(safeMetricRange.startDate, safeMetricRange.endDate) :
    null;
  const [pageInfo, pageInsights, pagePosts] = await Promise.all([
    fetchMetaGraph(
      META_FACEBOOK_PAGE_ID,
      { fields: "id,name,followers_count,fan_count" },
      accessToken,
    ),
    metaDateParams ?
      fetchMetaGraph(
        `${META_FACEBOOK_PAGE_ID}/insights`,
        {
          metric: "page_impressions_unique,page_post_engagements",
          period: "day",
          since: metaDateParams.since,
          until: metaDateParams.until,
        },
        accessToken,
      ) :
      Promise.resolve({ data: [] }),
    fetchAllMetaItems(
      `${META_FACEBOOK_PAGE_ID}/posts`,
      {
        fields: "id,created_time",
        since: contentDateParams.since,
        until: contentDateParams.until,
        limit: 100,
      },
      accessToken,
    ),
  ]);

  const insightData = pageInsights.data || [];

  return {
    followersEnd: Number(pageInfo.followers_count || pageInfo.fan_count) || 0,
    adSpend: 0,
    storyCount: 0,
    postCount: pagePosts.length,
    storyViews: 0,
    // We currently do not have a reliable story/post split from the same Meta surface.
    // Keep this conservative until Marketing API or a better Page endpoint is added.
    postViews: 0,
    // Inference: page reach is the closest currently-verified page-level visit proxy here.
    pageVisits: sumMetaInsightMetric(insightData, "page_impressions_unique"),
    postEngagements: sumMetaInsightMetric(insightData, "page_post_engagements"),
  };
}

/**
 * Fetches monthly Instagram business metrics.
 * @param {string} accessToken
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchInstagramMonthMetrics(accessToken, startDate, endDate) {
  const safeMetricRange = getSafeMetaMetricRange(startDate, endDate);
  const metaDateParams = safeMetricRange.hasRange ?
    getMetaApiDateParams(safeMetricRange.startDate, safeMetricRange.endDate) :
    null;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const followerMetricLowerBound = "2026-03-10";
  const followerMetricStartDate = [startDate, followerMetricLowerBound, formatIsoDate(thirtyDaysAgo)]
    .sort()
    .slice(-1)[0];
  const followerMetricEndDate = safeMetricRange.hasRange ?
    (safeMetricRange.endDate < formatIsoDate(yesterday) ? safeMetricRange.endDate : formatIsoDate(yesterday)) :
    null;
  const shouldFetchFollowerMetric = Boolean(followerMetricEndDate) && followerMetricStartDate <= followerMetricEndDate;
  const [accountInfo, userInsights, followerInsights, mediaItems, activeStories] = await Promise.all([
    fetchMetaGraph(
      META_INSTAGRAM_BUSINESS_ACCOUNT_ID,
      { fields: "id,username,followers_count,media_count" },
      accessToken,
    ),
    metaDateParams ?
      fetchMetaGraph(
        `${META_INSTAGRAM_BUSINESS_ACCOUNT_ID}/insights`,
        {
          metric: "profile_views,views,total_interactions",
          period: "day",
          metric_type: "total_value",
          since: metaDateParams.since,
          until: metaDateParams.until,
        },
        accessToken,
      ) :
      Promise.resolve({ data: [] }),
    shouldFetchFollowerMetric ?
      fetchMetaGraph(
        `${META_INSTAGRAM_BUSINESS_ACCOUNT_ID}/insights`,
        {
          metric: "follower_count",
          period: "day",
          since: followerMetricStartDate,
          until: followerMetricEndDate,
        },
        accessToken,
      ) :
      Promise.resolve({ data: [] }),
    fetchAllMetaItems(
      `${META_INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
      {
        fields: "id,media_type,media_product_type,timestamp",
        limit: 100,
      },
      accessToken,
    ),
    fetchMetaGraph(
      `${META_INSTAGRAM_BUSINESS_ACCOUNT_ID}/stories`,
      {
        fields: "id,timestamp,media_type",
      },
      accessToken,
    ).catch(() => ({ data: [] })),
  ]);

  const contentMedia = (mediaItems || []).filter((item) => {
    const mediaProductType = item.media_product_type || "";
    return mediaProductType !== "STORY" && isTimestampInRange(item.timestamp, startDate, endDate);
  });

  let postViews = 0;
  await Promise.all(contentMedia.map(async (item) => {
    try {
      const payload = await fetchMetaGraph(
        `${item.id}/insights`,
        { metric: "views" },
        accessToken,
      );
      const values = payload.data && payload.data[0] && payload.data[0].values ? payload.data[0].values : [];
      postViews += values.reduce((total, row) => total + (Number(row.value) || 0), 0);
    } catch (error) {
      console.warn(`Unable to read Instagram media insights for ${item.id}: ${error.message}`);
    }
  }));

  const totalViews = getMetaTotalValueMetric(userInsights.data || [], "views");
  const totalInteractions = getMetaTotalValueMetric(userInsights.data || [], "total_interactions");
  const newFollowers = sumMetaSeriesMetric(followerInsights.data || [], "follower_count");
  const activeStoriesInRange = (activeStories.data || []).filter((item) => isTimestampInRange(item.timestamp, startDate, endDate));

  return {
    followersEnd: Number(accountInfo.followers_count) || 0,
    adSpend: 0,
    storyCount: activeStoriesInRange.length,
    postCount: contentMedia.length,
    storyViews: Math.max(totalViews - postViews, 0),
    postViews,
    pageVisits: getMetaTotalValueMetric(userInsights.data || [], "profile_views"),
    totalViews,
    totalInteractions,
    newFollowers,
    contentShared: contentMedia.length,
  };
}

/**
 * Builds a readable title for an Instagram story.
 * @param {string} timestamp
 * @param {string} mediaType
 * @return {string}
 */
function buildInstagramStoryTitle(timestamp, mediaType) {
  const storyDate = new Date(timestamp);
  const dateText = storyDate.toLocaleDateString("et-EE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeText = storyDate.toLocaleTimeString("et-EE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const mediaTypeLabel = mediaType === "VIDEO" ? "Video stoori" : "Pildi stoori";
  return `${mediaTypeLabel} ${dateText} ${timeText}`;
}

/**
 * Fetches currently active Instagram stories from Meta.
 * @param {string} accessToken
 * @return {Promise<Array<Object>>}
 */
async function fetchCurrentInstagramStories(accessToken) {
  const payload = await fetchMetaGraph(
    `${META_INSTAGRAM_BUSINESS_ACCOUNT_ID}/stories`,
    {
      fields: "id,timestamp,media_type,permalink",
      limit: 100,
    },
    accessToken,
  ).catch(() => ({ data: [] }));

  const stories = (payload.data || []).map((item) => ({
    id: item.id,
    timestamp: item.timestamp,
    date: String(item.timestamp || "").slice(0, 10),
    mediaType: item.media_type || "IMAGE",
    title: buildInstagramStoryTitle(item.timestamp, item.media_type),
    permalink: item.permalink || null,
    storyViews: null,
  }));

  await Promise.all(stories.map(async (story) => {
    try {
      const viewsPayload = await fetchMetaGraph(
        `${story.id}/insights`,
        { metric: "views" },
        accessToken,
      );
      const values = viewsPayload.data && viewsPayload.data[0] && viewsPayload.data[0].values ? viewsPayload.data[0].values : [];
      story.storyViews = values.reduce((total, row) => total + (Number(row.value) || 0), 0);
    } catch (viewsError) {
      try {
        const impressionsPayload = await fetchMetaGraph(
          `${story.id}/insights`,
          { metric: "impressions" },
          accessToken,
        );
        const values = impressionsPayload.data && impressionsPayload.data[0] && impressionsPayload.data[0].values ? impressionsPayload.data[0].values : [];
        story.storyViews = values.reduce((total, row) => total + (Number(row.value) || 0), 0);
      } catch (impressionsError) {
        story.storyViews = null;
      }
    }
  }));

  return stories;
}

/**
 * Persists current Instagram stories into Firestore so their history survives the 24h API window.
 * @param {Array<Object>} stories
 * @return {Promise<void>}
 */
async function saveInstagramStoriesSnapshot(stories) {
  if (!stories || stories.length === 0) {
    return;
  }

  const batch = db.batch();
  stories.forEach((story) => {
    const docRef = db.collection(INSTAGRAM_STORIES_COLLECTION).doc(story.id);
    const {
      id,
      timestamp,
      date,
      mediaType,
      title,
      permalink,
      storyViews,
    } = story;
    batch.set(docRef, {
      id,
      timestamp,
      date,
      mediaType,
      title,
      permalink,
      storyViews,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();
}

/**
 * Loads Instagram stories from Firestore for the selected range.
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function getInstagramStoriesFromFirestore(startDate, endDate) {
  const snapshot = await db.collection(INSTAGRAM_STORIES_COLLECTION).orderBy("date", "asc").get();
  const docs = snapshot.docs.map((doc) => doc.data());
  const availableSince = docs.length > 0 ? docs[0].date : null;
  const stories = docs
    .filter((item) => item.date >= startDate && item.date <= endDate)
    .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));

  return {
    stories,
    availableSince,
  };
}

/**
 * Loads Firestore story snapshot fallback for the selected range.
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} platformKey
 * @return {Promise<Object>}
 */
async function getStoryFallbackFromFirestore(startDate, endDate, platformKey) {
  const [monthlySnapshot, dailySnapshot] = await Promise.all([
    db.collection("marketingData").orderBy("date", "asc").get(),
    db.collection("marketingDataDaily").orderBy("date", "asc").get(),
  ]);
  const docs = monthlySnapshot.docs.map((doc) => doc.data());
  const dailyDocs = dailySnapshot.docs.map((doc) => doc.data());
  const monthKeys = getMonthKeysForRange(startDate, endDate);

  const dailyDocsWithStories = dailyDocs.filter((item) => {
    const platformData = item[platformKey] || {};
    return platformData.storyCount != null;
  });

  const availableSince = dailyDocsWithStories.length > 0 ?
    dailyDocsWithStories[0].date :
    null;

  const selectedDocs = docs.filter((item) => monthKeys.includes(item.date.slice(0, 7)));
  const selectedDocsWithStories = selectedDocs.filter((item) => {
    const platformData = item[platformKey] || {};
    return platformData.storyCount != null || platformData.storyViews != null;
  });

  if (selectedDocsWithStories.length === 0) {
    return {
      storyCount: null,
      storyViews: null,
      availableSince,
    };
  }

  return {
    storyCount: selectedDocsWithStories.reduce((sum, item) => sum + (Number((item[platformKey] || {}).storyCount) || 0), 0),
    storyViews: selectedDocsWithStories.reduce((sum, item) => sum + (Number((item[platformKey] || {}).storyViews) || 0), 0),
    availableSince,
  };
}

/**
 * Captures currently active Instagram stories into Firestore.
 * @param {string} accessToken
 * @return {Promise<Array<Object>>}
 */
async function captureInstagramStories(accessToken) {
  const stories = await fetchCurrentInstagramStories(accessToken);
  await saveInstagramStoriesSnapshot(stories);
  return stories;
}

/**
 * Fetches Google Analytics totals for the provided date range.
 * @param {string} propertyId
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchGoogleAnalyticsMetrics(propertyId, startDate, endDate) {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      { startDate, endDate },
    ],
    dimensions: [
      { name: "sessionSourceMedium" },
    ],
    metrics: [
      { name: "sessions" },
      { name: "advertiserAdCost" },
    ],
  });

  let totalSessions = 0;
  let paidSessions = 0;
  let organicSessions = 0;
  let googleAdsCost = 0;

  (response.rows || []).forEach((row) => {
    const dimensionValues = row.dimensionValues || [];
    const metricValues = row.metricValues || [];
    const sourceMedium = ((dimensionValues[0] && dimensionValues[0].value) || "").toLowerCase();
    const sessions = parseInt((metricValues[0] && metricValues[0].value) || "0", 10);
    const adCost = parseFloat((metricValues[1] && metricValues[1].value) || "0");

    totalSessions += sessions;
    googleAdsCost += adCost;

    if (sourceMedium.includes("cpc") || sourceMedium.includes("paid")) {
      paidSessions += sessions;
    } else if (sourceMedium.includes("organic") || sourceMedium === "(direct) / (none)") {
      organicSessions += sessions;
    } else {
      organicSessions += sessions;
    }
  });

  return {
    websiteVisitsTotal: totalSessions,
    websiteVisitsPaid: paidSessions,
    websiteVisitsOrganic: organicSessions,
    googleAdsCost,
    costPerPaidSession: paidSessions > 0 ? googleAdsCost / paidSessions : null,
  };
}

/**
 * Fetches a sessions timeline grouped by hour for a single day or by date otherwise.
 * @param {string} propertyId
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchGoogleAnalyticsTimeline(propertyId, startDate, endDate) {
  const isSingleDay = startDate === endDate;
  const dimensionName = isSingleDay ? "hour" : "date";
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      { startDate, endDate },
    ],
    dimensions: [
      { name: dimensionName },
    ],
    metrics: [
      { name: "sessions" },
    ],
    orderBys: [
      {
        dimension: {
          dimensionName,
          orderType: "ALPHANUMERIC",
        },
      },
    ],
  });

  const sessionsByBucket = {};
  (response.rows || []).forEach((row) => {
    const dimensionValues = row.dimensionValues || [];
    const metricValues = row.metricValues || [];
    const bucket = (dimensionValues[0] && dimensionValues[0].value) || "";
    const sessions = parseInt((metricValues[0] && metricValues[0].value) || "0", 10);
    sessionsByBucket[bucket] = sessions;
  });

  const points = [];

  if (isSingleDay) {
    for (let hour = 0; hour < 24; hour += 1) {
      const hourKey = padMonthValue(hour);
      points.push({
        label: `${hourKey}:00`,
        bucket: hourKey,
        sessions: sessionsByBucket[hourKey] || 0,
      });
    }
  } else {
    const cursor = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    while (cursor <= end) {
      const isoDate = formatIsoDate(cursor);
      const apiKey = isoDate.replace(/-/g, "");
      points.push({
        label: isoDate,
        bucket: apiKey,
        sessions: sessionsByBucket[apiKey] || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return {
    granularity: isSingleDay ? "hour" : "day",
    points,
  };
}

/**
 * Downloads blog posts from the WordPress REST API.
 * @return {Promise<Array<Object>>}
 */
async function fetchBlogPostsFromSitemap() {
  const firstResponse = await fetch(`${BLOG_POSTS_API_URL}&page=1`);
  if (!firstResponse.ok) {
    throw new Error(`Failed to load blog posts: ${firstResponse.status}`);
  }

  const totalPages = parseInt(firstResponse.headers.get("x-wp-totalpages") || "1", 10);
  const firstPagePosts = await firstResponse.json();
  const remainingPageIndexes = [];
  for (let page = 2; page <= totalPages; page += 1) {
    remainingPageIndexes.push(page);
  }

  const remainingPages = await Promise.all(remainingPageIndexes.map(async (page) => {
    const response = await fetch(`${BLOG_POSTS_API_URL}&page=${page}`);
    if (!response.ok) {
      throw new Error(`Failed to load blog posts page ${page}: ${response.status}`);
    }
    return response.json();
  }));

  const allPosts = [firstPagePosts, ...remainingPages].flat();

  return allPosts.map((post) => {
    const url = post.link || "";
    const path = getPathFromUrl(url);
    const slug = path.split("/").filter(Boolean).pop() || path;
    return {
      url,
      path,
      slug,
      publishedAt: post.date ? post.date.slice(0, 10) : null,
      title: post.title && post.title.rendered ? post.title.rendered.replace(/<[^>]+>/g, "").trim() : slug,
    };
  }).filter((post) => post.url && post.path);
}

/**
 * Builds a GA4 in-list filter for page paths.
 * @param {Array<string>} paths
 * @return {Object}
 */
function buildPagePathFilter(paths) {
  return {
    filter: {
      fieldName: "pagePath",
      inListFilter: {
        values: paths,
        caseSensitive: false,
      },
    },
  };
}

/**
 * Fetches blog article totals and top posts for the selected period.
 * @param {string} propertyId
 * @param {Array<Object>} blogPosts
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchBlogPostPerformance(propertyId, blogPosts, startDate, endDate) {
  if (blogPosts.length === 0) {
    return {
      totalViews: 0,
      pageStats: [],
      lastPostViews: 0,
      newestPost: null,
      createdInRange: 0,
      topPosts: [],
    };
  }

  const paths = blogPosts.map((post) => post.path);
  const pageFilter = buildPagePathFilter(paths);
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      { startDate, endDate },
    ],
    dimensions: [
      { name: "pagePath" },
      { name: "pageTitle" },
    ],
    metrics: [
      { name: "screenPageViews" },
    ],
    dimensionFilter: pageFilter,
    orderBys: [
      {
        metric: {
          metricName: "screenPageViews",
        },
        desc: true,
      },
    ],
    limit: 250,
  });

  const pageStats = (response.rows || []).map((row) => {
    const dimensionValues = row.dimensionValues || [];
    const metricValues = row.metricValues || [];
    return {
      path: (dimensionValues[0] && dimensionValues[0].value) || "",
      title: (dimensionValues[1] && dimensionValues[1].value) || "",
      views: parseInt((metricValues[0] && metricValues[0].value) || "0", 10),
    };
  });

  const statsByPath = {};
  let totalViews = 0;
  pageStats.forEach((stat) => {
    statsByPath[stat.path] = stat;
    totalViews += stat.views;
  });

  const newestPost = [...blogPosts].sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))[0] || null;
  const createdInRange = blogPosts.filter((post) => post.publishedAt && post.publishedAt >= startDate && post.publishedAt <= endDate).length;
  const topPosts = pageStats.slice(0, 3).map((stat) => ({
    ...stat,
    url: `https://n8r.ee${stat.path}`,
  }));

  return {
    totalViews,
    pageStats,
    lastPostViews: newestPost ? (statsByPath[newestPost.path] ? statsByPath[newestPost.path].views : 0) : 0,
    newestPost: newestPost ? {
      ...newestPost,
      title: newestPost.title || (statsByPath[newestPost.path] && statsByPath[newestPost.path].title ? statsByPath[newestPost.path].title : newestPost.slug),
    } : null,
    createdInRange,
    topPosts,
  };
}

/**
 * Fetches a blog views timeline for the selected period.
 * @param {string} propertyId
 * @param {Array<Object>} blogPosts
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchBlogTimeline(propertyId, blogPosts, startDate, endDate) {
  if (blogPosts.length === 0) {
    return { granularity: "day", points: [] };
  }

  const isSingleDay = startDate === endDate;
  const dimensionName = isSingleDay ? "hour" : "date";
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      { startDate, endDate },
    ],
    dimensions: [
      { name: dimensionName },
    ],
    metrics: [
      { name: "screenPageViews" },
    ],
    dimensionFilter: buildPagePathFilter(blogPosts.map((post) => post.path)),
    orderBys: [
      {
        dimension: {
          dimensionName,
          orderType: "ALPHANUMERIC",
        },
      },
    ],
  });

  const viewsByBucket = {};
  (response.rows || []).forEach((row) => {
    const dimensionValues = row.dimensionValues || [];
    const metricValues = row.metricValues || [];
    const bucket = (dimensionValues[0] && dimensionValues[0].value) || "";
    viewsByBucket[bucket] = parseInt((metricValues[0] && metricValues[0].value) || "0", 10);
  });

  const points = [];
  if (isSingleDay) {
    for (let hour = 0; hour < 24; hour += 1) {
      const hourKey = padMonthValue(hour);
      points.push({
        label: `${hourKey}:00`,
        bucket: hourKey,
        value: viewsByBucket[hourKey] || 0,
      });
    }
  } else {
    const cursor = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    while (cursor <= end) {
      const isoDate = formatIsoDate(cursor);
      points.push({
        label: isoDate,
        bucket: isoDate.replace(/-/g, ""),
        value: viewsByBucket[isoDate.replace(/-/g, "")] || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return {
    granularity: isSingleDay ? "hour" : "day",
    points,
  };
}

/**
 * Fetches external referrers that sent traffic to blog posts.
 * @param {string} propertyId
 * @param {Array<Object>} blogPosts
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Array<Object>>}
 */
async function fetchExternalBlogReferrers(propertyId, blogPosts, startDate, endDate) {
  if (blogPosts.length === 0) {
    return [];
  }

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      { startDate, endDate },
    ],
    dimensions: [
      { name: "pageReferrer" },
    ],
    metrics: [
      { name: "screenPageViews" },
    ],
    dimensionFilter: {
      andGroup: {
        expressions: [
          buildPagePathFilter(blogPosts.map((post) => post.path)),
          {
            filter: {
              fieldName: "pageReferrer",
              stringFilter: {
                matchType: "BEGINS_WITH",
                value: "http",
                caseSensitive: false,
              },
            },
          },
          {
            notExpression: {
              filter: {
                fieldName: "pageReferrer",
                stringFilter: {
                  matchType: "CONTAINS",
                  value: "n8r.ee",
                  caseSensitive: false,
                },
              },
            },
          },
        ],
      },
    },
    orderBys: [
      {
        metric: {
          metricName: "screenPageViews",
        },
        desc: true,
      },
    ],
    limit: 10,
  });

  return (response.rows || []).map((row) => {
    const dimensionValues = row.dimensionValues || [];
    const metricValues = row.metricValues || [];
    return {
      referrer: (dimensionValues[0] && dimensionValues[0].value) || "",
      views: parseInt((metricValues[0] && metricValues[0].value) || "0", 10),
    };
  }).filter((item) => item.referrer && isMeaningfulExternalReferrer(item.referrer));
}

/**
 * Persists monthly Google metrics into the marketingData collection.
 * @param {Object} params
 * @return {Promise<void>}
 */
async function saveGoogleMonthToFirestore({ firestoreDocId, firstDayOfMonth, googleMetrics }) {
  const docRef = db.collection("marketingData").doc(firestoreDocId);
  const doc = await docRef.get();

  let existingData = {};
  if (doc.exists) {
    existingData = doc.data();
  }

  await docRef.set({
    ...existingData,
    date: firstDayOfMonth,
    google: {
      ...existingData.google,
      ...googleMetrics,
    },
  }, { merge: true });
}

/**
 * Persists monthly Meta social metrics into the marketingData collection.
 * @param {Object} params
 * @return {Promise<void>}
 */
async function saveMetaMonthToFirestore({ firestoreDocId, firstDayOfMonth, facebookMetrics, instagramMetrics }) {
  const docRef = db.collection("marketingData").doc(firestoreDocId);
  const doc = await docRef.get();

  let existingData = {};
  if (doc.exists) {
    existingData = doc.data();
  }

  await docRef.set({
    ...existingData,
    date: firstDayOfMonth,
    facebook: {
      ...existingData.facebook,
      ...facebookMetrics,
    },
    instagram: {
      ...existingData.instagram,
      ...instagramMetrics,
    },
  }, { merge: true });
}

/**
 * Persists daily Meta snapshots into a dedicated collection.
 * @param {Object} params
 * @return {Promise<void>}
 */
async function saveMetaDailySnapshot({
  snapshotDate,
  facebookFollowersEnd,
  facebookStoryCount,
  instagramFollowersEnd,
  instagramStoryCount,
}) {
  const docId = snapshotDate.replace(/-/g, "");
  const docRef = db.collection("marketingDataDaily").doc(docId);
  const payload = {
    date: snapshotDate,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (facebookFollowersEnd != null || facebookStoryCount != null) {
    payload.facebook = {};
    if (facebookFollowersEnd != null) {
      payload.facebook.followersEnd = facebookFollowersEnd;
    }
    if (facebookStoryCount != null) {
      payload.facebook.storyCount = facebookStoryCount;
    }
  }

  if (instagramFollowersEnd != null || instagramStoryCount != null) {
    payload.instagram = {};
    if (instagramFollowersEnd != null) {
      payload.instagram.followersEnd = instagramFollowersEnd;
    }
    if (instagramStoryCount != null) {
      payload.instagram.storyCount = instagramStoryCount;
    }
  }

  await docRef.set(payload, { merge: true });
}

/**
 * Loads a follower summary from daily snapshots for the selected platform and range.
 * @param {string} platformKey
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function getFollowerSummaryFromDailySnapshots(platformKey, startDate, endDate) {
  const snapshot = await db.collection("marketingDataDaily").orderBy("date", "asc").get();
  const docs = snapshot.docs.map((doc) => doc.data()).filter((item) => {
    return item[platformKey] && item[platformKey].followersEnd != null;
  });

  const availableSince = docs.length > 0 ? docs[0].date : null;
  const startSnapshot = docs.filter((item) => item.date <= startDate).pop() || null;
  const endSnapshot = docs.filter((item) => item.date <= endDate).pop() || null;

  return {
    availableSince,
    startFollowers: startSnapshot ? Number(startSnapshot[platformKey].followersEnd) || 0 : null,
    endFollowers: endSnapshot ? Number(endSnapshot[platformKey].followersEnd) || 0 : null,
  };
}

/**
 * Performs an authenticated Smaily API request.
 * @param {string} path
 * @param {Object} [params]
 * @return {Promise<*>}
 */
async function fetchSmailyApi(path, params = {}) {
  const url = new URL(`https://${SMAILY_SUBDOMAIN}.sendsmaily.net/api/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") {
      return;
    }
    url.searchParams.set(key, String(value));
  });

  const credentials = Buffer.from(`${SMAILY_API_USER.value()}:${SMAILY_API_PASSWORD.value()}`).toString("base64");
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
    },
  });

  const textPayload = await response.text();
  let payload = null;
  try {
    payload = textPayload ? JSON.parse(textPayload) : null;
  } catch (error) {
    throw new Error(`Smaily API returned invalid JSON for ${path}`);
  }

  if (!response.ok) {
    throw new Error(`Smaily API request failed for ${path}`);
  }

  if (payload && payload.error) {
    throw new Error(payload.error || `Smaily API request failed for ${path}`);
  }

  return payload;
}

/**
 * Groups numeric values by YYYY-MM-DD labels inside a date range.
 * @param {Array<Object>} rows
 * @param {string} dateField
 * @param {string} startDate
 * @param {string} endDate
 * @param {Function} valueGetter
 * @return {Array<{label: string, value: number}>}
 */
function groupRowsByDay(rows, dateField, startDate, endDate, valueGetter) {
  const totalsByDay = new Map();
  rows.forEach((row) => {
    const rawDate = row[dateField];
    if (!rawDate) {
      return;
    }

    const dayLabel = String(rawDate).slice(0, 10);
    if (dayLabel < startDate || dayLabel > endDate) {
      return;
    }

    const currentValue = totalsByDay.get(dayLabel) || 0;
    totalsByDay.set(dayLabel, currentValue + (Number(valueGetter(row)) || 0));
  });

  return buildDailyTimeline(Array.from(totalsByDay.entries()).map(([label, value]) => ({ label, value })), startDate, endDate);
}

/**
 * Fetches Smaily campaign details for the selected period.
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchSmailyCampaignMetrics(startDate, endDate) {
  const campaignsPayload = await fetchSmailyApi("campaign.php", {
    status: "COMPLETED",
    sort_by: "created_at",
    sort_order: "DESC",
    limit: 200,
  });

  const campaigns = Array.isArray(campaignsPayload) ? campaignsPayload : [];
  const campaignsInRange = campaigns.filter((campaign) => {
    const completedAt = String(campaign.completed_at || campaign.created_at || "").slice(0, 10);
    return completedAt && completedAt >= startDate && completedAt <= endDate;
  });

  const items = [];
  for (const campaign of campaignsInRange) {
    try {
      const detailPayload = await fetchSmailyApi("campaign.php", { id: campaign.id });
      items.push({
        id: campaign.id,
        name: campaign.name || "Nimetu kampaania",
        completedAt: campaign.completed_at || campaign.created_at || null,
        clickCount: Number(detailPayload.click_count) || 0,
        uniqueClickCount: Number(detailPayload.unique_click_count) || 0,
        openedCount: Number(detailPayload.opened_count) || 0,
      });
    } catch (error) {
      console.warn(`Unable to read Smaily campaign detail ${campaign.id}: ${error.message}`);
      items.push({
        id: campaign.id,
        name: campaign.name || "Nimetu kampaania",
        completedAt: campaign.completed_at || campaign.created_at || null,
        clickCount: 0,
        uniqueClickCount: 0,
        openedCount: 0,
      });
    }
  }

  items.sort((a, b) => (b.openedCount || 0) - (a.openedCount || 0));

  return {
    periodCount: items.length,
    totalClicks: items.reduce((sum, item) => sum + (item.clickCount || 0), 0),
    items,
    timeline: groupRowsByDay(
      items,
      "completedAt",
      startDate,
      endDate,
      (item) => item.openedCount || 0,
    ),
  };
}

/**
 * Builds unix timestamp bounds with a one-day buffer to avoid timezone edge clipping.
 * We filter the returned rows again by local YYYY-MM-DD labels afterwards.
 * @param {string} startDate
 * @param {string} endDate
 * @return {{startAt: number, endAt: number}}
 */
function getBufferedUnixBoundsForSmailyRange(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(`${endDate}T23:59:59Z`);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    startAt: Math.floor(start.getTime() / 1000),
    endAt: Math.floor(end.getTime() / 1000),
  };
}

/**
 * Fetches paginated Smaily subscriber history rows.
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Array<Object>>}
 */
async function fetchSmailySubscriberHistoryRows(startDate, endDate) {
  const { startAt, endAt } = getBufferedUnixBoundsForSmailyRange(startDate, endDate);
  const allRows = [];
  let sinceSeqId = null;
  let hasMoreRows = true;

  while (hasMoreRows) {
    const payload = await fetchSmailyApi("history.php", {
      start_at: startAt,
      end_at: endAt,
      since_seq_id: sinceSeqId,
      limit: 1000,
    });
    const rows = Array.isArray(payload) ? payload : [];
    if (rows.length === 0) {
      break;
    }

    allRows.push(...rows);
    sinceSeqId = rows[rows.length - 1] ? rows[rows.length - 1].seq_id : null;
    if (!sinceSeqId || rows.length < 1000) {
      hasMoreRows = false;
    }
  }

  return allRows;
}

/**
 * Fetches paginated Smaily message action log rows.
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Array<Object>>}
 */
async function fetchSmailyMessageActionRows(startDate, endDate) {
  const { startAt, endAt } = getBufferedUnixBoundsForSmailyRange(startDate, endDate);
  const allRows = [];
  let page = 1;
  let hasMoreRows = true;

  while (hasMoreRows) {
    const payload = await fetchSmailyApi("message/action/log.php", {
      start_at: startAt,
      end_at: endAt,
      page,
      limit: 1000,
    });
    const rows = Array.isArray(payload) ? payload : [];
    if (rows.length === 0) {
      break;
    }

    allRows.push(...rows);
    if (rows.length < 1000) {
      hasMoreRows = false;
    }
    page += 1;
  }

  return allRows;
}

/**
 * Fetches direct daily Smaily metrics for ranges up to 30 days.
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchSmailyLiveDailyMetrics(startDate, endDate) { // eslint-disable-line no-unused-vars
  const [historyRows, messageActionRows] = await Promise.all([
    fetchSmailySubscriberHistoryRows(startDate, endDate),
    fetchSmailyMessageActionRows(startDate, endDate),
  ]);

  const optInRows = historyRows.filter((row) => {
    const action = String(row.action || "").toLowerCase();
    const dateLabel = String(row.time || "").slice(0, 10);
    return action === "optin" && dateLabel >= startDate && dateLabel <= endDate;
  });

  const openRows = messageActionRows.filter((row) => {
    const action = String(row.action || "").toLowerCase();
    const dateLabel = String(row.created_at || row.time || "").slice(0, 10);
    return action === "view" && dateLabel >= startDate && dateLabel <= endDate;
  });

  const clickRows = messageActionRows.filter((row) => {
    const action = String(row.action || "").toLowerCase();
    const dateLabel = String(row.created_at || row.time || "").slice(0, 10);
    return action === "click" && dateLabel >= startDate && dateLabel <= endDate;
  });

  const newSubscribersTimeline = groupRowsByDay(
    optInRows,
    "time",
    startDate,
    endDate,
    () => 1,
  );
  const opensTimeline = groupRowsByDay(
    openRows,
    "created_at",
    startDate,
    endDate,
    () => 1,
  );
  const clicksTimeline = groupRowsByDay(
    clickRows,
    "created_at",
    startDate,
    endDate,
    () => 1,
  );

  return {
    newSubscribers: {
      periodCount: optInRows.length,
      timeline: newSubscribersTimeline,
    },
    opens: {
      periodCount: openRows.length,
      timeline: opensTimeline,
    },
    clicks: {
      periodCount: clickRows.length,
      timeline: clicksTimeline,
    },
  };
}

/* eslint-disable no-unused-vars */
/**
 * Saves Smaily daily metrics into marketingDataDaily.
 * @param {Object} params
 * @return {Promise<void>}
 */
async function saveSmailyDailySnapshots({
  activeSubscribers,
  newSubscribersTimeline,
  opensTimeline,
  clicksTimeline,
}) {
  const writes = new Map();

  const ensureEntry = (dateLabel) => {
    if (!writes.has(dateLabel)) {
      writes.set(dateLabel, {
        date: dateLabel,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        newsletter: {},
      });
    }
    return writes.get(dateLabel);
  };

  if (activeSubscribers != null) {
    const todayLabel = formatIsoDate(new Date());
    const entry = ensureEntry(todayLabel);
    entry.newsletter.activeSubscribers = Number(activeSubscribers) || 0;
  }

  ((newSubscribersTimeline && newSubscribersTimeline.points) || []).forEach((point) => {
    const entry = ensureEntry(point.label);
    entry.newsletter.newSubscribers = Number(point.value) || 0;
  });

  ((opensTimeline && opensTimeline.points) || []).forEach((point) => {
    const entry = ensureEntry(point.label);
    entry.newsletter.emailOpens = Number(point.value) || 0;
  });

  ((clicksTimeline && clicksTimeline.points) || []).forEach((point) => {
    const entry = ensureEntry(point.label);
    entry.newsletter.emailClicks = Number(point.value) || 0;
  });

  await Promise.all(Array.from(writes.values()).map(async (payload) => {
    const docRef = db.collection("marketingDataDaily").doc(payload.date.replace(/-/g, ""));
    await docRef.set(payload, { merge: true });
  }));
}
/* eslint-enable no-unused-vars */

/**
 * Reads saved Smaily daily metrics from Firestore for longer ranges.
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchSmailyStoredDailyMetrics(startDate, endDate) { // eslint-disable-line no-unused-vars
  const snapshot = await db.collection("marketingDataDaily").orderBy("date", "asc").get();
  const docs = snapshot.docs
    .map((doc) => doc.data())
    .filter((item) => item.newsletter && item.date);

  const availableSince = docs.length > 0 ? docs[0].date : null;
  const inRange = docs.filter((item) => item.date >= startDate && item.date <= endDate);

  const buildTimelineFromField = (fieldName) => {
    if (inRange.length === 0) {
      return null;
    }
    return buildDailyTimeline(
      inRange.map((item) => ({
        label: item.date,
        value: Number(item.newsletter && item.newsletter[fieldName]) || 0,
      })),
      startDate,
      endDate,
    );
  };

  const sumField = (fieldName) => inRange.reduce((sum, item) => sum + (Number(item.newsletter && item.newsletter[fieldName]) || 0), 0);
  const latestActiveSubscribers = docs.filter((item) => item.newsletter && item.newsletter.activeSubscribers != null).pop();

  return {
    availableSince,
    activeSubscribers: latestActiveSubscribers ? Number(latestActiveSubscribers.newsletter.activeSubscribers) || 0 : null,
    newSubscribers: {
      periodCount: inRange.length === 0 ? null : sumField("newSubscribers"),
      timeline: buildTimelineFromField("newSubscribers"),
      availableSince,
    },
    opens: {
      periodCount: inRange.length === 0 ? null : sumField("emailOpens"),
      timeline: buildTimelineFromField("emailOpens"),
      availableSince,
    },
    clicks: {
      periodCount: inRange.length === 0 ? null : sumField("emailClicks"),
      timeline: buildTimelineFromField("emailClicks"),
      availableSince,
    },
  };
}

/**
 * Fetches Smaily subscriber change metrics for the selected period.
 * Uses subscriber `subscribed_at` values directly, which is more stable than
 * the history log for retrospective period analysis.
 * @param {string} startDate
 * @param {string} endDate
 * @return {Promise<Object>}
 */
async function fetchSmailySubscriberMetrics(startDate, endDate) {
  const contactsPayload = await fetchSmailyApi("contact.php", {
    list: 1,
    limit: 25000,
    fields: "subscribed_at,created_at,is_unsubscribed",
  });
  const contacts = Array.isArray(contactsPayload) ? contactsPayload : [];
  const subscribedInRange = contacts.filter((contact) => {
    const subscribedAt = String(contact.subscribed_at || contact.created_at || "").slice(0, 10);
    return subscribedAt && subscribedAt >= startDate && subscribedAt <= endDate;
  });

  return {
    periodCount: subscribedInRange.length,
    timeline: groupRowsByDay(
      subscribedInRange,
      "subscribed_at",
      startDate,
      endDate,
      () => 1,
    ),
  };
}

/**
 * Fetches the active subscriber total from Smaily.
 * @return {Promise<number|null>}
 */
async function fetchSmailyActiveSubscribers() {
  const listsPayload = await fetchSmailyApi("list.php");
  const lists = Array.isArray(listsPayload) ? listsPayload : [];
  const allSubscribersList = lists.find((item) => String(item.name || "").trim().toLowerCase() === "all subscribers");
  if (allSubscribersList) {
    return Number(allSubscribersList.subscribers_count) || 0;
  }

  if (lists.length === 0) {
    return null;
  }

  return Math.max(...lists.map((item) => Number(item.subscribers_count) || 0));
}

exports.startMetaOAuth = onRequest(
  {
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    const authUrl = new URL("https://www.facebook.com/v25.0/dialog/oauth");
    authUrl.searchParams.set("client_id", META_APP_ID);
    authUrl.searchParams.set("redirect_uri", META_OAUTH_CALLBACK_URL);
    authUrl.searchParams.set("scope", META_AUTH_SCOPES.join(","));
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("extras", JSON.stringify({ setup: {} }));
    res.redirect(authUrl.toString());
  },
);

exports.getMetaAuthStatus = onRequest(
  {
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    try {
      const storedIntegration = await getStoredMetaIntegration();
      return res.status(200).json({
        connected: !!(storedIntegration && storedIntegration.pageAccessToken),
        pageName: storedIntegration && storedIntegration.pageName ? storedIntegration.pageName : "Ilukliinik NOOR",
        expiresAt: storedIntegration && storedIntegration.expiresAt ? storedIntegration.expiresAt : null,
        updatedAt: storedIntegration && storedIntegration.updatedAt ? storedIntegration.updatedAt : null,
      });
    } catch (error) {
      console.error("Error reading Meta auth status:", error);
      return res.status(500).json({
        error: error.message,
      });
    }
  },
);

exports.completeMetaOAuth = onRequest(
  {
    secrets: [META_APP_SECRET],
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    try {
      const { code, error, error_message: errorMessage } = req.query;

      if (error) {
        throw new Error(errorMessage || String(error));
      }

      if (!code) {
        throw new Error("Meta callback did not include an authorization code.");
      }

      const shortLivedTokenUrl = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
      shortLivedTokenUrl.searchParams.set("client_id", META_APP_ID);
      shortLivedTokenUrl.searchParams.set("client_secret", META_APP_SECRET.value());
      shortLivedTokenUrl.searchParams.set("redirect_uri", META_OAUTH_CALLBACK_URL);
      shortLivedTokenUrl.searchParams.set("code", String(code));

      const shortLivedResponse = await fetch(shortLivedTokenUrl.toString());
      const shortLivedPayload = await shortLivedResponse.json();
      if (!shortLivedResponse.ok || shortLivedPayload.error) {
        throw new Error(
          shortLivedPayload &&
          shortLivedPayload.error &&
          shortLivedPayload.error.message ?
            shortLivedPayload.error.message :
            "Meta short-lived token exchange failed.",
        );
      }

      const longLivedTokenUrl = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
      longLivedTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
      longLivedTokenUrl.searchParams.set("client_id", META_APP_ID);
      longLivedTokenUrl.searchParams.set("client_secret", META_APP_SECRET.value());
      longLivedTokenUrl.searchParams.set("fb_exchange_token", shortLivedPayload.access_token);

      const longLivedResponse = await fetch(longLivedTokenUrl.toString());
      const longLivedPayload = await longLivedResponse.json();
      if (!longLivedResponse.ok || longLivedPayload.error) {
        throw new Error(
          longLivedPayload &&
          longLivedPayload.error &&
          longLivedPayload.error.message ?
            longLivedPayload.error.message :
            "Meta long-lived token exchange failed.",
        );
      }

      const pagesPayload = await fetchMetaGraph(
        "me/accounts",
        { fields: "id,name,access_token" },
        longLivedPayload.access_token,
      );
      const page = (pagesPayload.data || []).find((item) => item.id === META_FACEBOOK_PAGE_ID);

      if (!page || !page.access_token) {
        throw new Error("Configured Facebook Page token was not returned by Meta.");
      }

      const expiresAt = new Date(Date.now() + ((longLivedPayload.expires_in || 0) * 1000)).toISOString();
      await saveStoredMetaIntegration({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        longLivedUserToken: longLivedPayload.access_token,
        expiresAt,
      });

      return res.status(200).json({
        success: true,
        pageName: page.name,
        expiresAt,
      });
    } catch (error) {
      console.error("Meta OAuth completion failed:", error);
      return res.status(500).json({
        error: error.message,
      });
    }
  },
);

exports.startYouTubeOAuth = onRequest(
  {
    secrets: [GBP_CLIENT_SECRET],
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    try {
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_BUSINESS_PROFILE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", YOUTUBE_OAUTH_CALLBACK_URL);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", YOUTUBE_AUTH_SCOPES.join(" "));
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent select_account");
      authUrl.searchParams.set("include_granted_scopes", "true");
      return res.redirect(authUrl.toString());
    } catch (error) {
      console.error("Error starting YouTube OAuth:", error);
      const redirectUrl = new URL(DASHBOARD_URL);
      redirectUrl.searchParams.set("youtubeAuth", "error");
      redirectUrl.searchParams.set("message", error.message);
      return res.redirect(redirectUrl.toString());
    }
  },
);

exports.completeYouTubeOAuth = onRequest(
  {
    secrets: [GBP_CLIENT_SECRET],
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    const redirectUrl = new URL(DASHBOARD_URL);

    try {
      const { code, error, error_description: errorDescription } = req.query;

      if (error) {
        throw new Error(errorDescription || String(error));
      }

      if (!code) {
        throw new Error("YouTube callback did not include an authorization code.");
      }

      const oauthClient = buildYouTubeOAuthClient();
      const tokenResponse = await oauthClient.getToken(String(code));
      const tokens = tokenResponse.tokens || {};

      if (!tokens.refresh_token && !tokens.access_token) {
        throw new Error("YouTube token exchange did not return usable tokens.");
      }

      const existingIntegration = await getStoredYouTubeIntegration();
      await saveStoredYouTubeIntegration({
        accessToken: tokens.access_token || "",
        refreshToken: tokens.refresh_token ||
          (existingIntegration && existingIntegration.refreshToken ? existingIntegration.refreshToken : ""),
        expiryDate: tokens.expiry_date || null,
        scope: tokens.scope || YOUTUBE_AUTH_SCOPES.join(" "),
        tokenType: tokens.token_type || "Bearer",
      });

      redirectUrl.searchParams.set("youtubeAuth", "success");
      redirectUrl.searchParams.set("message", "YouTube kanal ühendati edukalt.");
      return res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error("Error completing YouTube OAuth:", error);
      redirectUrl.searchParams.set("youtubeAuth", "error");
      redirectUrl.searchParams.set("message", error.message);
      return res.redirect(redirectUrl.toString());
    }
  },
);

exports.startTikTokOAuth = onRequest(
  {
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;

    if (!clientKey) {
      const demoUrl = new URL(DASHBOARD_URL);
      demoUrl.searchParams.set("tiktokAuth", "demo");
      demoUrl.searchParams.set(
        "message",
        "TikTok app is ready for review demo. Add the approved client key to enable the live OAuth screen.",
      );
      return res.redirect(demoUrl.toString());
    }

    const state = `noor-${Date.now()}`;
    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authUrl.searchParams.set("client_key", clientKey);
    authUrl.searchParams.set("scope", "user.info.basic");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", TIKTOK_OAUTH_CALLBACK_URL);
    authUrl.searchParams.set("state", state);
    return res.redirect(authUrl.toString());
  },
);

exports.completeTikTokOAuth = onRequest(
  {
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    const { code, error, error_description: errorDescription } = req.query;
    const redirectUrl = new URL(DASHBOARD_URL);

    if (error) {
      redirectUrl.searchParams.set("tiktokAuth", "error");
      redirectUrl.searchParams.set("message", errorDescription ? String(errorDescription) : String(error));
      return res.redirect(redirectUrl.toString());
    }

    if (!code) {
      redirectUrl.searchParams.set("tiktokAuth", "demo");
      redirectUrl.searchParams.set("message", "TikTok returned to the dashboard. Live token exchange will be enabled after app approval.");
      return res.redirect(redirectUrl.toString());
    }

    redirectUrl.searchParams.set("tiktokAuth", "success");
    redirectUrl.searchParams.set("message", "TikTok authorization code received. Token exchange is ready to be connected after app approval.");
    return res.redirect(redirectUrl.toString());
  },
);

// HTTPS Cloud Function, mida saate käivitada käsitsi (nt browserist või curl käsurealt)
// Võite selle hiljem asendada ajastatud funktsiooniga, kasutades onSchedule
exports.fetchGoogleAnalyticsData = onRequest(
  {
    secrets: [GA_PROPERTY_ID],
    cors: true,
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    try {
      // --- DIAGNOSTIKA ---
      console.log("Cloud Function 'fetchGoogleAnalyticsData' started.");
      const propertyId = GA_PROPERTY_ID.value();
      console.log(`GA_PROPERTY_ID read from secret: ${propertyId}`);
      // --- LÕPP DIAGNOSTIKA ---

      const today = new Date();
      // Loome kuupäeva eelmise kuu esimese päeva kohta (nt kui täna on 7. mai, siis 1. aprill)
      // Sest enamasti tahame koguda eelmise täis kuu andmeid
      const targetDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const { firstDayOfMonth, lastDayOfMonth, firestoreDocId } = getMonthDateRange(targetDate);
      const googleMetrics = await fetchGoogleAnalyticsMetrics(propertyId, firstDayOfMonth, lastDayOfMonth);

      await saveGoogleMonthToFirestore({
        firestoreDocId,
        firstDayOfMonth,
        googleMetrics,
      });

      console.log(`Google Analytics data for ${firstDayOfMonth} fetched and saved successfully.`);
      return res.status(200).send(`Google Analytics data for ${firstDayOfMonth} fetched and saved successfully.`);
    } catch (error) {
      console.error("Error fetching or saving Google Analytics data:", error);
      return res.status(500).send(`Error fetching or saving Google Analytics data: ${error.message}`);
    }
  },
);

// Ajastatud funktsioon Google Analyticsi andmete toomiseks iga kuu 2. päeval kell 3 hommikul
// See tagab, et eelmise kuu kõik andmed on Analyticsis juba töödeldud.
exports.scheduleGoogleAnalyticsFetch = onSchedule(
  {
    schedule: "2 3 * * *",
    timeZone: "Europe/Tallinn",
    secrets: [GA_PROPERTY_ID],
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (context) => {
    try {
      // --- DIAGNOSTIKA ---
      console.log("Cloud Function 'scheduleGoogleAnalyticsFetch' started.");
      const propertyId = GA_PROPERTY_ID.value();
      console.log(`GA_PROPERTY_ID read from secret: ${propertyId}`);

      const today = new Date();
      // Loome kuupäeva eelmise kuu esimese päeva kohta
      const targetDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const { firstDayOfMonth, lastDayOfMonth, firestoreDocId } = getMonthDateRange(targetDate);
      const googleMetrics = await fetchGoogleAnalyticsMetrics(propertyId, firstDayOfMonth, lastDayOfMonth);

      await saveGoogleMonthToFirestore({
        firestoreDocId,
        firstDayOfMonth,
        googleMetrics,
      });

      console.log(`Scheduled GA data fetch: Google Analytics data for ${firstDayOfMonth} fetched and saved successfully.`);
      return null; // Ajastatud funktsioonid ei tagasta HTTPS vastust
    } catch (error) {
      console.error("Scheduled GA data fetch: Error fetching or saving Google Analytics data:", error);
      return null;
    }
  },
);

exports.fetchGoogleAnalyticsRange = onRequest(
  {
    secrets: [GA_PROPERTY_ID],
    cors: true,
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    try {
      const propertyId = GA_PROPERTY_ID.value();
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: "startDate and endDate query parameters are required.",
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          error: "startDate cannot be later than endDate.",
        });
      }

      const googleMetrics = await fetchGoogleAnalyticsMetrics(propertyId, startDate, endDate);
      const timeline = await fetchGoogleAnalyticsTimeline(propertyId, startDate, endDate);

      return res.status(200).json({
        startDate,
        endDate,
        google: googleMetrics,
        timeline,
      });
    } catch (error) {
      console.error("Error fetching Google Analytics range data:", error);
      return res.status(500).json({
        error: error.message,
      });
    }
  },
);

exports.fetchGoogleBusinessProfileRange = onRequest(
  {
    secrets: [GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN],
    cors: true,
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    try {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: "startDate and endDate query parameters are required.",
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          error: "startDate cannot be later than endDate.",
        });
      }

      const accessToken = await getGoogleBusinessAccessToken();
      const [reviewPayload, performancePayload] = await Promise.all([
        fetchGoogleReviews(accessToken),
        fetchGoogleBusinessPerformance(accessToken, startDate, endDate),
      ]);
      const periodReviewSummary = buildGoogleReviewRangeSummary(
        reviewPayload.reviews,
        startDate,
        endDate,
      );

      return res.status(200).json({
        startDate,
        endDate,
        accountId: GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID,
        locationId: GOOGLE_BUSINESS_PROFILE_LOCATION_ID,
        reviews: {
          averageRating: reviewPayload.averageRating,
          totalReviewCount: reviewPayload.totalReviewCount,
          periodNewReviews: periodReviewSummary.newReviews,
          periodAverageRating: periodReviewSummary.averageRating,
          latestReviews: periodReviewSummary.latestReviews,
          timeline: buildGoogleReviewsTimeline(reviewPayload.reviews, startDate, endDate),
        },
        performance: performancePayload,
      });
    } catch (error) {
      console.error("Error fetching Google Business Profile range data:", error);
      return res.status(500).json({
        error: error.message,
        code: error.code || "GOOGLE_BUSINESS_PROFILE_ERROR",
      });
    }
  },
);

exports.fetchSmailyRange = onRequest(
  {
    secrets: [SMAILY_API_USER, SMAILY_API_PASSWORD],
    cors: true,
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    try {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: "startDate and endDate query parameters are required.",
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          error: "startDate cannot be later than endDate.",
        });
      }

      const [activeSubscribers, newSubscribers, campaigns] = await Promise.all([
        fetchSmailyActiveSubscribers(),
        fetchSmailySubscriberMetrics(startDate, endDate),
        fetchSmailyCampaignMetrics(startDate, endDate),
      ]);

      return res.status(200).json({
        startDate,
        endDate,
        activeSubscribers,
        newSubscribers,
        campaigns,
      });
    } catch (error) {
      console.error("Error fetching Smaily range data:", error);
      return res.status(500).json({
        error: error.message,
      });
    }
  },
);

exports.fetchMediaPerformanceRange = onRequest(
  {
    secrets: [GBP_CLIENT_SECRET],
    cors: true,
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    try {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: "startDate and endDate query parameters are required.",
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          error: "startDate cannot be later than endDate.",
        });
      }

      const snapshot = await db.collection("mediaPerformanceDaily")
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .orderBy("date", "asc")
        .get();
      const docs = snapshot.docs.map((doc) => doc.data());
      const payload = buildMediaPerformancePayload(docs, startDate, endDate);
      const youtubePerformance = await fetchYouTubePerformanceRange(startDate, endDate);

      if (youtubePerformance) {
        payload.youtube = youtubePerformance;
      } else {
        payload.youtube.setupRequired = true;
        payload.youtube.channel = {
          id: "",
          title: YOUTUBE_CHANNEL_DISPLAY_NAME,
        };
      }

      return res.status(200).json(payload);
    } catch (error) {
      console.error("Error fetching media performance range data:", error);
      return res.status(500).json({
        error: error.message,
      });
    }
  },
);

exports.fetchBlogInsights = onRequest(
  {
    secrets: [GA_PROPERTY_ID],
    cors: true,
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    try {
      const propertyId = GA_PROPERTY_ID.value();
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: "startDate and endDate query parameters are required.",
        });
      }

      const blogPosts = await fetchBlogPostsFromSitemap();
      const [overview, timeline, referrals] = await Promise.all([
        fetchBlogPostPerformance(propertyId, blogPosts, startDate, endDate),
        fetchBlogTimeline(propertyId, blogPosts, startDate, endDate),
        fetchExternalBlogReferrers(propertyId, blogPosts, startDate, endDate),
      ]);

      return res.status(200).json({
        startDate,
        endDate,
        totalPosts: blogPosts.length,
        createdInRange: overview.createdInRange,
        newestPost: overview.newestPost,
        newestPostViews: overview.lastPostViews,
        topPosts: overview.topPosts,
        allPosts: overview.pageStats.map((post) => ({
          ...post,
          url: `https://n8r.ee${post.path}`,
        })),
        externalReferrers: referrals.slice(0, 3),
        timeline,
        totalViews: overview.totalViews,
      });
    } catch (error) {
      console.error("Error fetching blog insights:", error);
      return res.status(500).json({
        error: error.message,
      });
    }
  },
);

exports.fetchMetaSocialData = onRequest(
  {
    secrets: [META_PAGE_ACCESS_TOKEN],
    cors: true,
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    try {
      const targetDate = resolveTargetMonth(req.query.month);
      const { firstDayOfMonth, lastDayOfMonth, firestoreDocId } = getMonthDateRange(targetDate);
      const accessToken = await getMetaAccessToken();

      const [facebookMetrics, instagramMetrics] = await Promise.all([
        fetchFacebookMonthMetrics(accessToken, firstDayOfMonth, lastDayOfMonth),
        fetchInstagramMonthMetrics(accessToken, firstDayOfMonth, lastDayOfMonth),
      ]);
      await captureInstagramStories(accessToken);

      await saveMetaMonthToFirestore({
        firestoreDocId,
        firstDayOfMonth,
        facebookMetrics,
        instagramMetrics,
      });

      await saveMetaDailySnapshot({
        snapshotDate: formatIsoDate(new Date()),
        facebookFollowersEnd: facebookMetrics.followersEnd,
        facebookStoryCount: facebookMetrics.storyCount,
        instagramFollowersEnd: instagramMetrics.followersEnd,
        instagramStoryCount: instagramMetrics.storyCount,
      });

      return res.status(200).json({
        month: firstDayOfMonth.slice(0, 7),
        date: firstDayOfMonth,
        facebook: facebookMetrics,
        instagram: instagramMetrics,
        savedTo: firestoreDocId,
      });
    } catch (error) {
      console.error("Error fetching Meta social data:", error);
      return res.status(500).json({
        error: error.message,
      });
    }
  },
);

exports.fetchMetaSocialRange = onRequest(
  {
    secrets: [META_PAGE_ACCESS_TOKEN, META_ADS_ACCESS_TOKEN],
    cors: true,
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    try {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: "startDate and endDate query parameters are required.",
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          error: "startDate cannot be later than endDate.",
        });
      }

      const [accessToken, adsAccessToken] = await Promise.all([
        getMetaAccessToken(),
        getMetaAdsAccessToken(),
      ]);
      if (endDate >= formatIsoDate(new Date())) {
        await captureInstagramStories(accessToken);
      }
      const metaChunks = getMetaApiChunksForRange(startDate, endDate);
      const [facebookTopPosts, instagramTopPosts, metaAdSpend, metaAdRankings, metaAdClicksTimeline] = await Promise.all([
        fetchFacebookTopPosts(accessToken, startDate, endDate),
        fetchInstagramTopPosts(accessToken, startDate, endDate),
        fetchMetaAdSpend(adsAccessToken, startDate, endDate).catch((error) => {
          console.warn(`Unable to read Meta ad spend: ${error.message}`);
          return {
            boostSpend: null,
            facebookAdSpend: null,
            instagramAdSpend: null,
            totalAdSpend: null,
          };
        }),
        fetchMetaAdRankings(adsAccessToken, startDate, endDate).catch((error) => {
          console.warn(`Unable to read Meta ad rankings: ${error.message}`);
          return {
            facebookBoosts: [],
            instagramBoosts: [],
            linkClicks: [],
            totals: {
              facebookBoostSpend: null,
              instagramBoostSpend: null,
              linkClicksTotal: null,
            },
          };
        }),
        fetchMetaAdClicksTimeline(adsAccessToken, startDate, endDate).catch((error) => {
          console.warn(`Unable to read Meta ad clicks timeline: ${error.message}`);
          return buildDailyTimeline([], startDate, endDate);
        }),
      ]);
      const facebookAggregated = {
        followersEnd: 0,
        adSpend: 0,
        storyCount: null,
        storyViews: null,
        postCount: 0,
        postViews: null,
        pageVisits: 0,
        postEngagements: 0,
      };
      const instagramAggregated = {
        followersEnd: 0,
        adSpend: 0,
        storyCount: null,
        storyViews: null,
        postCount: 0,
        postViews: 0,
        pageVisits: 0,
        totalViews: 0,
        totalInteractions: 0,
        newFollowers: 0,
        contentShared: 0,
      };

      for (const chunk of metaChunks) {
        const [facebookMetrics, instagramMetrics] = await Promise.all([
          fetchFacebookMonthMetrics(accessToken, chunk.startDate, chunk.endDate),
          fetchInstagramMonthMetrics(accessToken, chunk.startDate, chunk.endDate),
        ]);

        facebookAggregated.followersEnd = facebookMetrics.followersEnd;
        facebookAggregated.adSpend += facebookMetrics.adSpend || 0;
        facebookAggregated.postCount += facebookMetrics.postCount || 0;
        facebookAggregated.pageVisits += facebookMetrics.pageVisits || 0;
        facebookAggregated.postEngagements += facebookMetrics.postEngagements || 0;

        instagramAggregated.followersEnd = instagramMetrics.followersEnd;
        instagramAggregated.adSpend += instagramMetrics.adSpend || 0;
        instagramAggregated.postCount += instagramMetrics.postCount || 0;
        instagramAggregated.postViews += instagramMetrics.postViews || 0;
        instagramAggregated.pageVisits += instagramMetrics.pageVisits || 0;
        instagramAggregated.totalViews += instagramMetrics.totalViews || 0;
        instagramAggregated.totalInteractions += instagramMetrics.totalInteractions || 0;
        instagramAggregated.newFollowers += instagramMetrics.newFollowers || 0;
        instagramAggregated.contentShared += instagramMetrics.contentShared || 0;
      }

      const [facebookStoryFallback, instagramStoryFallback, instagramStoriesSnapshot, instagramTimeline, facebookTimeline, facebookFollowerSummary, instagramFollowerSummary] = await Promise.all([
        getStoryFallbackFromFirestore(startDate, endDate, "facebook"),
        getStoryFallbackFromFirestore(startDate, endDate, "instagram"),
        getInstagramStoriesFromFirestore(startDate, endDate),
        fetchInstagramViewsTimeline(accessToken, startDate, endDate),
        fetchFacebookReachTimeline(accessToken, startDate, endDate),
        getFollowerSummaryFromDailySnapshots("facebook", startDate, endDate),
        getFollowerSummaryFromDailySnapshots("instagram", startDate, endDate),
      ]);

      return res.status(200).json({
        startDate,
        endDate,
        facebook: {
          ...facebookAggregated,
          storyCount: facebookStoryFallback.storyCount,
          storyViews: facebookStoryFallback.storyViews,
          storyDataAvailableSince: facebookStoryFallback.availableSince,
          postViews: null,
          followerSummary: facebookFollowerSummary,
        },
        instagram: {
          ...instagramAggregated,
          storyCount: instagramStoriesSnapshot.stories.length > 0 ? instagramStoriesSnapshot.stories.length : instagramStoryFallback.storyCount,
          storyViews: instagramStoryFallback.storyViews,
          storyDataAvailableSince: instagramStoriesSnapshot.availableSince || instagramStoryFallback.availableSince,
          contentShared: instagramAggregated.postCount,
          followerSummary: instagramFollowerSummary,
        },
        facebookTopPosts,
        instagramTopPosts,
        instagramStories: instagramStoriesSnapshot.stories,
        facebookTimeline,
        instagramTimeline,
        metaAds: {
          ...metaAdSpend,
          ...metaAdRankings.totals,
          facebookBoosts: metaAdRankings.facebookBoosts,
          instagramBoosts: metaAdRankings.instagramBoosts,
          linkClicks: metaAdRankings.linkClicks,
          linkClicksTimeline: metaAdClicksTimeline,
        },
      });
    } catch (error) {
      console.error("Error fetching Meta social range data:", error);
      return res.status(500).json({
        error: error.message,
      });
    }
  },
);

exports.scheduleMetaSocialFetch = onSchedule(
  {
    schedule: "7 4 2 * *",
    timeZone: "Europe/Tallinn",
    secrets: [META_PAGE_ACCESS_TOKEN],
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async () => {
    try {
      const targetDate = resolveTargetMonth();
      const { firstDayOfMonth, lastDayOfMonth, firestoreDocId } = getMonthDateRange(targetDate);
      const accessToken = await getMetaAccessToken();

      const [facebookMetrics, instagramMetrics] = await Promise.all([
        fetchFacebookMonthMetrics(accessToken, firstDayOfMonth, lastDayOfMonth),
        fetchInstagramMonthMetrics(accessToken, firstDayOfMonth, lastDayOfMonth),
      ]);
      await captureInstagramStories(accessToken);

      await saveMetaMonthToFirestore({
        firestoreDocId,
        firstDayOfMonth,
        facebookMetrics,
        instagramMetrics,
      });

      await saveMetaDailySnapshot({
        snapshotDate: formatIsoDate(new Date()),
        facebookFollowersEnd: facebookMetrics.followersEnd,
        facebookStoryCount: facebookMetrics.storyCount,
        instagramFollowersEnd: instagramMetrics.followersEnd,
        instagramStoryCount: instagramMetrics.storyCount,
      });

      console.log(`Meta social data for ${firstDayOfMonth} fetched and saved successfully.`);
    } catch (error) {
      console.error("Scheduled Meta social fetch failed:", error);
    }
    return null;
  },
);

exports.scheduleInstagramStoryCapture = onSchedule(
  {
    schedule: "0 */3 * * *",
    timeZone: "Europe/Tallinn",
    secrets: [META_PAGE_ACCESS_TOKEN],
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async () => {
    try {
      const accessToken = await getMetaAccessToken();
      const stories = await captureInstagramStories(accessToken);
      const accountInfo = await fetchMetaGraph(
        META_INSTAGRAM_BUSINESS_ACCOUNT_ID,
        { fields: "followers_count" },
        accessToken,
      );
      await saveMetaDailySnapshot({
        snapshotDate: formatIsoDate(new Date()),
        facebookFollowersEnd: null,
        facebookStoryCount: null,
        instagramFollowersEnd: Number(accountInfo.followers_count) || 0,
        instagramStoryCount: stories.length,
      });
      console.log(`Instagram story capture saved ${stories.length} stories.`);
    } catch (error) {
      console.error("Scheduled Instagram story capture failed:", error);
    }
    return null;
  },
);

exports.assignInstagramStoryOwner = onRequest(
  {
    cors: true,
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    try {
      const body = req.body || {};
      const storyId = body.storyId || req.query.storyId;
      const assignedTo = body.assignedTo || req.query.assignedTo || "";

      if (!storyId) {
        return res.status(400).json({ error: "storyId is required." });
      }

      await db.collection(INSTAGRAM_STORIES_COLLECTION).doc(String(storyId)).set({
        assignedTo: String(assignedTo).trim(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return res.status(200).json({
        success: true,
        storyId,
        assignedTo: String(assignedTo).trim(),
      });
    } catch (error) {
      console.error("Error assigning Instagram story owner:", error);
      return res.status(500).json({
        error: error.message,
      });
    }
  },
);
