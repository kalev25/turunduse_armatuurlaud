// Impordime vajalikud funktsioonid Firebase SDK-st otse CDN-ist
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import { getAuth, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy, limitToLast } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
// ^^^^^ KONTROLLI KÕIKI VERSIOONE! Need peavad olema kõik sama versiooninumbriga (nt 10.12.0)!

// Teie veebirakenduse Firebase konfiguratsioon (see on teie projekti info)
const firebaseConfig = {
  apiKey: "AIzaSyDxgF7zbcnf3pq-NsI7mwdfdI0dEIyV3dQ",
  authDomain: "turundus-deb6d.firebaseapp.com",
  projectId: "turundus-deb6d",
  storageBucket: "turundus-deb6d.firebasestorage.app",
  messagingSenderId: "812777264860",
  appId: "1:812777264860:web:444347c99df27fe0f78619",
  measurementId: "G-GFFPWGLXQ9"
};

// Initsialiseerime Firebase'i rakenduse
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initsialiseerime Firebase Authenticationi
const auth = getAuth(app);

// Initsialiseerime Cloud Firestore'i
const db = getFirestore(app);

// Hankime HTML-elementide viited (autentimiseks)
const googleLoginButton = document.getElementById('google-login-button');
const logoutButton = document.getElementById('logout-button');
const userStatus = document.getElementById('user-status');
const authError = document.getElementById('auth-error');
const authContainer = document.getElementById('auth-container');
const dashboardContent = document.getElementById('dashboard-content');
const userEmailDisplay = document.getElementById('user-email-display');
const dashboardStatus = document.getElementById('dashboard-status');
const metaAuthButton = document.getElementById('meta-auth-button');
const metaAuthStatus = document.getElementById('meta-auth-status');
const metaTokenBadge = document.getElementById('meta-token-badge');
const GOOGLE_ANALYTICS_RANGE_URL = 'https://us-central1-turundus-deb6d.cloudfunctions.net/fetchGoogleAnalyticsRange';
const GOOGLE_BUSINESS_PROFILE_RANGE_URL = 'https://us-central1-turundus-deb6d.cloudfunctions.net/fetchGoogleBusinessProfileRange';
const BLOG_INSIGHTS_URL = 'https://us-central1-turundus-deb6d.cloudfunctions.net/fetchBlogInsights';
const META_SOCIAL_RANGE_URL = 'https://us-central1-turundus-deb6d.cloudfunctions.net/fetchMetaSocialRange';
const SMAILY_RANGE_URL = 'https://us-central1-turundus-deb6d.cloudfunctions.net/fetchSmailyRange';
const MEDIA_PERFORMANCE_RANGE_URL = 'https://us-central1-turundus-deb6d.cloudfunctions.net/fetchMediaPerformanceRange';
const ASSIGN_INSTAGRAM_STORY_OWNER_URL = 'https://us-central1-turundus-deb6d.cloudfunctions.net/assignInstagramStoryOwner';
const META_AUTH_START_URL = 'https://us-central1-turundus-deb6d.cloudfunctions.net/startMetaOAuth';
const META_AUTH_STATUS_URL = 'https://us-central1-turundus-deb6d.cloudfunctions.net/getMetaAuthStatus';
const META_AUTH_COMPLETE_URL = 'https://us-central1-turundus-deb6d.cloudfunctions.net/completeMetaOAuth';
const FOLLOWER_DATA_AVAILABLE_SINCE = '2026-04-08';
const INSTAGRAM_CONTENT_DATA_AVAILABLE_SINCE = '2026-03-08';

// Arenduse ajal ajutine cache andmete hoidmiseks, et mitte iga kord Firestore'ist lugeda
let marketingDataCache = []; 
let marketingDataDailyCache = [];
let googleRangeRequestId = 0;
let blogInsightsRequestId = 0;
let blogTopPostsExpanded = false;
let facebookTopPostsExpanded = false;
let instagramTopPostsExpanded = false;
let latestBlogPayload = null;
let latestFacebookTopPosts = [];
let latestInstagramTopPosts = [];
let latestInstagramStories = [];
let instagramStoriesExpanded = false;
let latestGoogleReviews = [];
let googleReviewsExpanded = false;
let latestGoogleBusinessPerformance = null;
let selectedGoogleBusinessMetric = null;
let latestMetaFacebookBoosts = [];
let latestMetaInstagramBoosts = [];
let latestMetaLinkClicks = [];
let metaFacebookBoostsExpanded = false;
let metaInstagramBoostsExpanded = false;
let metaLinkClicksExpanded = false;
let latestSmailyCampaigns = [];
let latestSmailyCampaignClicksTimeline = null;
let latestSmailyNewSubscribersTimeline = null;
let smailyCampaignsExpanded = false;
let smailyNewSubscribersExpanded = false;
let latestMediaPerformance = null;
let youtubeVideosExpanded = false;
const STORY_OWNER_SENTINEL = '__custom__';
const DEFAULT_STORY_OWNER_OPTIONS = ['Määramata'];
// UUS: Kuupäevavahemiku valijad ja nupp
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const applyDateRangeButton = document.getElementById('apply-date-range');
const rangePickerDetails = document.getElementById('range-picker-details');
const selectedRangeLabel = document.getElementById('selected-range-label');
const presetButtons = document.querySelectorAll('[data-range-preset]');
const mobileRangePreset = document.getElementById('mobile-range-preset');




// Hankime HTML-elementide viited (andmete kuvamiseks)
// Google Analytics
const googleTotalVisits = document.getElementById('google-total-visits');
const googlePaidVisits = document.getElementById('google-paid-visits');
const googleOrganicVisits = document.getElementById('google-organic-visits');
const googleAdCost = document.getElementById('google-ad-cost');
const googleCostPerPaidSession = document.getElementById('google-cost-per-paid-session');
const googleAverageSessions = document.getElementById('google-average-sessions');
const gaSessionsChart = document.getElementById('ga-sessions-chart');
const gaChartAxis = document.getElementById('ga-chart-axis');
const gaChartTooltip = document.getElementById('ga-chart-tooltip');
const gaChartSubtitle = document.getElementById('ga-chart-subtitle');
const gaChartEmpty = document.getElementById('ga-chart-empty');
const blogPostsCreated = document.getElementById('blog-posts-created');
const blogLatestPostTitle = document.getElementById('blog-latest-post-title');
const blogLatestPostMeta = document.getElementById('blog-latest-post-meta');
const blogContentCost = document.getElementById('blog-content-cost');
const blogTopPosts = document.getElementById('blog-top-posts');
const blogTopPostsHeading = document.getElementById('blog-top-posts-heading');
const blogTopPostsToggle = document.getElementById('blog-top-posts-toggle');
const blogReferrers = document.getElementById('blog-referrers');
const blogStatus = document.getElementById('blog-status');
const blogReadsChart = document.getElementById('blog-reads-chart');
const blogChartAxis = document.getElementById('blog-chart-axis');
const blogChartTooltip = document.getElementById('blog-chart-tooltip');
const blogChartSubtitle = document.getElementById('blog-chart-subtitle');
const blogChartEmpty = document.getElementById('blog-chart-empty');
const BLOG_POST_COST_EUR = 100;

// Facebook
const fbFollowers = document.getElementById('fb-followers');
const fbAdSpend = document.getElementById('fb-ad-spend');
const fbStoryCount = document.getElementById('fb-story-count');
const fbPostCount = document.getElementById('fb-post-count');
const fbInteractions = document.getElementById('fb-interactions');
const fbStoryViews = document.getElementById('fb-story-views');
const fbPostViews = document.getElementById('fb-post-views');
const fbPageVisits = document.getElementById('fb-page-visits');
const fbCostPerFollower = document.getElementById('fb-cost-per-follower');
const fbTopPosts = document.getElementById('fb-top-posts');
const fbPostCountToggle = document.getElementById('fb-post-count-toggle');
const fbPostCountArrow = document.getElementById('fb-post-count-arrow');
const fbReachChart = document.getElementById('fb-reach-chart');
const fbChartAxis = document.getElementById('fb-chart-axis');
const fbChartTooltip = document.getElementById('fb-chart-tooltip');
const fbChartSubtitle = document.getElementById('fb-chart-subtitle');
const fbChartEmpty = document.getElementById('fb-chart-empty');

// Instagram
const instaFollowers = document.getElementById('insta-followers');
const instaAdSpend = document.getElementById('insta-ad-spend');
const instaNewFollowersRow = document.getElementById('insta-new-followers-row');
const instaNewFollowers = document.getElementById('insta-new-followers');
const instaStoryCount = document.getElementById('insta-story-count');
const instaStoryCountToggle = document.getElementById('insta-story-count-toggle');
const instaStoryCountArrow = document.getElementById('insta-story-count-arrow');
const instaStoriesList = document.getElementById('insta-stories-list');
const instaPostCount = document.getElementById('insta-post-count');
const instaPostCountToggle = document.getElementById('insta-post-count-toggle');
const instaPostCountArrow = document.getElementById('insta-post-count-arrow');
const instaStoryViews = document.getElementById('insta-story-views');
const instaPostViews = document.getElementById('insta-post-views');
const instaPageVisits = document.getElementById('insta-page-visits');
const instaCostPerFollower = document.getElementById('insta-cost-per-follower');
const instaTopPosts = document.getElementById('insta-top-posts');
const instaViewsChart = document.getElementById('insta-views-chart');
const instaChartAxis = document.getElementById('insta-chart-axis');
const instaChartTooltip = document.getElementById('insta-chart-tooltip');
const instaChartSubtitle = document.getElementById('insta-chart-subtitle');
const instaChartEmpty = document.getElementById('insta-chart-empty');

const metaTotalAdSpend = document.getElementById('meta-total-ad-spend');
const metaFacebookBoostSpend = document.getElementById('meta-facebook-boost-spend');
const metaInstagramBoostSpend = document.getElementById('meta-instagram-boost-spend');
const metaLinkClicksTotal = document.getElementById('meta-link-clicks-total');
const metaFacebookBoostsToggle = document.getElementById('meta-facebook-boosts-toggle');
const metaInstagramBoostsToggle = document.getElementById('meta-instagram-boosts-toggle');
const metaLinkClicksToggle = document.getElementById('meta-link-clicks-toggle');
const metaFacebookBoostsArrow = document.getElementById('meta-facebook-boosts-arrow');
const metaInstagramBoostsArrow = document.getElementById('meta-instagram-boosts-arrow');
const metaLinkClicksArrow = document.getElementById('meta-link-clicks-arrow');
const metaFacebookBoostsList = document.getElementById('meta-facebook-boosts-list');
const metaInstagramBoostsList = document.getElementById('meta-instagram-boosts-list');
const metaLinkClicksList = document.getElementById('meta-link-clicks-list');
const metaAdsChart = document.getElementById('meta-ads-chart');
const metaAdsChartAxis = document.getElementById('meta-ads-chart-axis');
const metaAdsChartTooltip = document.getElementById('meta-ads-chart-tooltip');
const metaAdsChartSubtitle = document.getElementById('meta-ads-chart-subtitle');
const metaAdsChartEmpty = document.getElementById('meta-ads-chart-empty');

const youtubeAuthStatus = document.getElementById('youtube-auth-status');
const youtubeTopToggle = document.getElementById('youtube-top-toggle');
const youtubeTopTitle = document.getElementById('youtube-top-title');
const youtubeTopViews = document.getElementById('youtube-top-views');
const youtubeTopArrow = document.getElementById('youtube-top-arrow');
const youtubeVideosList = document.getElementById('youtube-videos-list');
const mediaPerformanceChart = document.getElementById('media-performance-chart');
const mediaPerformanceChartAxis = document.getElementById('media-performance-chart-axis');
const mediaPerformanceChartTooltip = document.getElementById('media-performance-chart-tooltip');
const mediaPerformanceChartSubtitle = document.getElementById('media-chart-subtitle');
const mediaPerformanceChartEmpty = document.getElementById('media-performance-chart-empty');

// Smaily
const smailyTitleCount = document.getElementById('smaily-title-count');
const smailyNewSubscribers = document.getElementById('smaily-new-subscribers');
const smailyNewSubscribersToggle = document.getElementById('smaily-new-subscribers-toggle');
const smailyNewSubscribersArrow = document.getElementById('smaily-new-subscribers-arrow');
const smailyNewSubscribersChartPanel = document.getElementById('smaily-new-subscribers-chart-panel');
const smailyNewSubscribersChart = document.getElementById('smaily-new-subscribers-chart');
const smailyNewSubscribersChartAxis = document.getElementById('smaily-new-subscribers-chart-axis');
const smailyNewSubscribersChartTooltip = document.getElementById('smaily-new-subscribers-chart-tooltip');
const smailyNewSubscribersChartSubtitle = document.getElementById('smaily-new-subscribers-chart-subtitle');
const smailyNewSubscribersChartEmpty = document.getElementById('smaily-new-subscribers-chart-empty');
const smailyCampaignCount = document.getElementById('smaily-campaign-count');
const smailyCampaignsToggle = document.getElementById('smaily-campaigns-toggle');
const smailyCampaignsArrow = document.getElementById('smaily-campaigns-arrow');
const smailyCampaignsList = document.getElementById('smaily-campaigns-list');
const smailyCampaignClicksChart = document.getElementById('smaily-campaign-clicks-chart');
const smailyCampaignClicksChartAxis = document.getElementById('smaily-campaign-clicks-chart-axis');
const smailyCampaignClicksChartTooltip = document.getElementById('smaily-campaign-clicks-chart-tooltip');
const smailyCampaignClicksChartSubtitle = document.getElementById('smaily-campaign-clicks-chart-subtitle');
const smailyCampaignClicksChartEmpty = document.getElementById('smaily-campaign-clicks-chart-empty');

// Google Reviews
const googleReviewsTitleCount = document.getElementById('google-reviews-title-count');
const googleReviewsPeriodNew = document.getElementById('google-reviews-period-new');
const googleReviewsPeriodRating = document.getElementById('google-reviews-period-rating');
const googleReviewsToggle = document.getElementById('google-reviews-toggle');
const googleReviewsToggleLabel = document.getElementById('google-reviews-toggle-label');
const googleReviewsToggleArrow = document.getElementById('google-reviews-toggle-arrow');
const googleReviewsList = document.getElementById('google-reviews-list');
const googleReviewsChart = document.getElementById('google-reviews-chart');
const googleReviewsChartAxis = document.getElementById('google-reviews-chart-axis');
const googleReviewsChartTooltip = document.getElementById('google-reviews-chart-tooltip');
const googleReviewsChartSubtitle = document.getElementById('google-reviews-chart-subtitle');
const googleReviewsChartEmpty = document.getElementById('google-reviews-chart-empty');

// Google Business Profile
const googleBusinessProfileViews = document.getElementById('google-business-profile-views');
const googleBusinessSearchViews = document.getElementById('google-business-search-views');
const googleBusinessMapsViews = document.getElementById('google-business-maps-views');
const googleBusinessWebsiteClicks = document.getElementById('google-business-website-clicks');
const googleBusinessCallClicks = document.getElementById('google-business-call-clicks');
const googleBusinessDirectionRequests = document.getElementById('google-business-direction-requests');
const googleBusinessProfileViewsToggle = document.getElementById('google-business-profile-views-toggle');
const googleBusinessSearchViewsToggle = document.getElementById('google-business-search-views-toggle');
const googleBusinessMapsViewsToggle = document.getElementById('google-business-maps-views-toggle');
const googleBusinessWebsiteClicksToggle = document.getElementById('google-business-website-clicks-toggle');
const googleBusinessCallClicksToggle = document.getElementById('google-business-call-clicks-toggle');
const googleBusinessDirectionRequestsToggle = document.getElementById('google-business-direction-requests-toggle');
const googleBusinessChartPanel = document.getElementById('google-business-chart-panel');
const googleBusinessChart = document.getElementById('google-business-chart');
const googleBusinessChartAxis = document.getElementById('google-business-chart-axis');
const googleBusinessChartTooltip = document.getElementById('google-business-chart-tooltip');
const googleBusinessChartSubtitle = document.getElementById('google-business-chart-subtitle');
const googleBusinessChartEmpty = document.getElementById('google-business-chart-empty');
const googleBusinessChartTitle = document.getElementById('google-business-chart-title');

const GOOGLE_BUSINESS_METRIC_CONFIG = {
    profileViews: { toggle: googleBusinessProfileViewsToggle, title: 'Profiili vaatamised ajas', label: 'profiilivaatamist' },
    searchViews: { toggle: googleBusinessSearchViewsToggle, title: 'Google Search vaatamised ajas', label: 'Search vaatamist' },
    mapsViews: { toggle: googleBusinessMapsViewsToggle, title: 'Google Maps vaatamised ajas', label: 'Maps vaatamist' },
    websiteClicks: { toggle: googleBusinessWebsiteClicksToggle, title: 'Veebilehe klikid ajas', label: 'veebiklikki' },
    callClicks: { toggle: googleBusinessCallClicksToggle, title: 'Kõne klikid ajas', label: 'kõneklikki' },
    directionRequests: { toggle: googleBusinessDirectionRequestsToggle, title: 'Teekonna päringud ajas', label: 'teekonna päringut' }
};

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateForDisplay(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('et-EE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatDateForShortDisplay(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('et-EE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    });
}

function formatDateTimeForDisplay(timestamp) {
    if (!timestamp) {
        return 'Kuupäev teadmata';
    }

    const date = new Date(timestamp);
    return date.toLocaleString('et-EE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function setSelectedRangeLabel(startDate, endDate, sourceLabel = '') {
    if (!selectedRangeLabel) {
        return;
    }

    const prefix = sourceLabel ? `${sourceLabel}: ` : '';
    selectedRangeLabel.textContent = `${prefix}${formatDateForDisplay(startDate)} kuni ${formatDateForDisplay(endDate)}`;
}

function getPresetDateRange(preset) {
    const today = new Date();
    const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayOfWeek = currentDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    switch (preset) {
        case 'current-week': {
            const start = new Date(currentDate);
            start.setDate(currentDate.getDate() + mondayOffset);
            return { startDate: formatDateForInput(start), endDate: formatDateForInput(currentDate), label: 'Jooksev nädal' };
        }
        case 'previous-week': {
            const end = new Date(currentDate);
            end.setDate(currentDate.getDate() + mondayOffset - 1);
            const start = new Date(end);
            start.setDate(end.getDate() - 6);
            return { startDate: formatDateForInput(start), endDate: formatDateForInput(end), label: 'Eelmine nädal' };
        }
        case 'previous-month': {
            const start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            const end = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
            return { startDate: formatDateForInput(start), endDate: formatDateForInput(end), label: 'Eelmine kuu' };
        }
        case 'current-year': {
            const start = new Date(currentDate.getFullYear(), 0, 1);
            return { startDate: formatDateForInput(start), endDate: formatDateForInput(currentDate), label: 'Jooksev aasta' };
        }
        case 'previous-year': {
            const start = new Date(currentDate.getFullYear() - 1, 0, 1);
            const end = new Date(currentDate.getFullYear() - 1, 11, 31);
            return { startDate: formatDateForInput(start), endDate: formatDateForInput(end), label: 'Eelmine aasta' };
        }
        case 'current-month':
        default: {
            const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            return { startDate: formatDateForInput(start), endDate: formatDateForInput(currentDate), label: 'Jooksev kuu' };
        }
    }
}

function applyRangeSelection({ startDate, endDate, label = '' }) {
    startDateInput.value = startDate;
    endDateInput.value = endDate;
    setSelectedRangeLabel(startDate, endDate, label);
    if (rangePickerDetails) {
        rangePickerDetails.open = false;
    }
    fetchAndDisplayMarketingData({ startDate, endDate, label });
}

function setTextValue(element, value) {
    element.textContent = value ?? 'N/A';
}

function setRangeMetricValue(element, value, unavailableText = 'Andmed puuduvad') {
    if (value == null) {
        element.textContent = unavailableText;
        return;
    }

    element.textContent = value;
}

function getDateRangeDayCount(startDate, endDate) {
    if (!startDate || !endDate) {
        return 0;
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function shouldShowInstagramNewFollowers(startDate, endDate) {
    return getDateRangeDayCount(startDate, endDate) <= 30;
}

function findFirstReliableFollowerSnapshot(allMarketingData, platformKey) {
    return allMarketingData.find((item) =>
        item.date >= FOLLOWER_DATA_AVAILABLE_SINCE &&
        item[platformKey] &&
        item[platformKey].followersEnd != null
    );
}

function findPreviousFollowerSnapshot(allMarketingData, platformKey, startDate) {
    return allMarketingData
        .filter((item) =>
            item.date >= FOLLOWER_DATA_AVAILABLE_SINCE &&
            item.date < startDate &&
            item[platformKey] &&
            item[platformKey].followersEnd != null
        )
        .pop();
}

function getFollowerSummaryDisplay(allMarketingData, platformKey, selectedFilter, currentFollowers) {
    const availableSinceText = formatDateForShortDisplay(FOLLOWER_DATA_AVAILABLE_SINCE);
    const endDate = selectedFilter?.endDate;
    const startDate = selectedFilter?.startDate;

    if (currentFollowers == null) {
        return `Andmed puuduvad (alates ${availableSinceText})`;
    }

    if (!endDate || endDate < FOLLOWER_DATA_AVAILABLE_SINCE) {
        return `Andmed puuduvad (alates ${availableSinceText})`;
    }

    const firstSnapshot = findFirstReliableFollowerSnapshot(allMarketingData, platformKey);
    if (!firstSnapshot) {
        return `${currentFollowers} (..)`;
    }

    if (!startDate || startDate < firstSnapshot.date) {
        return `${currentFollowers} (..)`; 
    }

    const previousSnapshot = findPreviousFollowerSnapshot(allMarketingData, platformKey, startDate);
    if (!previousSnapshot) {
        return `${currentFollowers} (..)`;
    }

    const numericGrowth = currentFollowers - (previousSnapshot[platformKey]?.followersEnd || 0);
    const changeText = numericGrowth >= 0 ? `+${numericGrowth}` : `${numericGrowth}`;
    return `${currentFollowers} (${changeText})`;
}

function getTodayDateString() {
    return formatDateForInput(new Date());
}

function findFirstDailyFollowerSnapshot(platformKey) {
    return marketingDataDailyCache.find((item) =>
        item[platformKey] &&
        item[platformKey].followersEnd != null
    );
}

function findDailyFollowerSnapshotOnOrBefore(platformKey, targetDate) {
    return marketingDataDailyCache
        .filter((item) =>
            item.date <= targetDate &&
            item[platformKey] &&
            item[platformKey].followersEnd != null
        )
        .pop();
}

function getMetaFollowerSummaryDisplay(platformKey, selectedFilter, apiEndFollowers) {
    const availableSinceSnapshot = findFirstDailyFollowerSnapshot(platformKey);
    const availableSinceText = availableSinceSnapshot ?
        formatDateForShortDisplay(availableSinceSnapshot.date) :
        formatDateForShortDisplay(FOLLOWER_DATA_AVAILABLE_SINCE);
    const startDate = selectedFilter?.startDate;
    const endDate = selectedFilter?.endDate;
    const isEndingToday = endDate === getTodayDateString();

    const endSnapshot = endDate ? findDailyFollowerSnapshotOnOrBefore(platformKey, endDate) : null;
    const startSnapshot = startDate ? findDailyFollowerSnapshotOnOrBefore(platformKey, startDate) : null;
    const endFollowers = isEndingToday && apiEndFollowers != null ?
        apiEndFollowers :
        (endSnapshot?.[platformKey]?.followersEnd ?? null);

    if (endFollowers == null) {
        return `Andmed puuduvad (alates ${availableSinceText})`;
    }

    if (!startSnapshot) {
        return `${endFollowers} (..)`;
    }

    const startFollowers = startSnapshot[platformKey]?.followersEnd;
    if (startFollowers == null) {
        return `${endFollowers} (..)`;
    }

    const growth = endFollowers - startFollowers;
    const growthText = growth >= 0 ? `+${growth}` : `${growth}`;
    return `${endFollowers} (${growthText})`;
}

function getMetaFollowerSummaryFromPayload(summary, selectedFilter, apiEndFollowers) {
    const startDate = selectedFilter?.startDate;
    const endDate = selectedFilter?.endDate;
    const isEndingToday = endDate === getTodayDateString();
    const availableSinceText = formatDateForShortDisplay(summary?.availableSince || FOLLOWER_DATA_AVAILABLE_SINCE);
    const fallbackEndFollowers = summary?.endFollowers ?? null;
    const endFollowers = isEndingToday && apiEndFollowers != null ? apiEndFollowers : fallbackEndFollowers;

    if (endFollowers == null) {
        return `Andmed puuduvad (alates ${availableSinceText})`;
    }

    if (startDate && summary?.availableSince && startDate < summary.availableSince) {
        return `${endFollowers} (..)`;
    }

    if (summary?.startFollowers == null) {
        return `${endFollowers} (..)`;
    }

    const growth = endFollowers - summary.startFollowers;
    const growthText = growth >= 0 ? `+${growth}` : `${growth}`;
    return `${endFollowers} (${growthText})`;
}

function getMonthKey(dateString) {
    return dateString.slice(0, 7);
}

function getSelectedMonthKeys(startDateString, endDateString) {
    const keys = [];
    const cursor = new Date(`${startDateString}T00:00:00`);
    const end = new Date(`${endDateString}T00:00:00`);

    cursor.setDate(1);
    end.setDate(1);

    while (cursor <= end) {
        keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }

    return keys;
}

function clearMainMetricsWithFallback(fallbackText = 'N/A') {
    [
        googleTotalVisits,
        googlePaidVisits,
        googleOrganicVisits,
        googleAdCost,
        googleCostPerPaidSession,
        googleAverageSessions,
        fbFollowers,
        fbAdSpend,
        fbStoryCount,
        fbPostCount,
        fbInteractions,
        fbStoryViews,
        fbPostViews,
        fbPageVisits,
        fbCostPerFollower,
        instaFollowers,
        instaAdSpend,
        instaNewFollowers,
        instaStoryCount,
        instaPostCount,
        instaStoryViews,
        instaPostViews,
        instaPageVisits,
        instaCostPerFollower,
        metaFacebookBoostSpend,
        metaInstagramBoostSpend,
        metaLinkClicksTotal,
        metaTotalAdSpend,
        youtubeTopTitle,
        youtubeTopViews,
        smailyNewSubscribers,
        smailyCampaignCount,
        googleReviewsPeriodNew,
        googleReviewsPeriodRating,
        googleBusinessProfileViews,
        googleBusinessSearchViews,
        googleBusinessMapsViews,
        googleBusinessWebsiteClicks,
        googleBusinessCallClicks,
        googleBusinessDirectionRequests,
    ].forEach((element) => {
        if (element) {
            element.textContent = fallbackText;
        }
    });
}

function formatCurrency(value) {
    if (value == null || Number.isNaN(value)) {
        return 'N/A';
    }

    return new Intl.NumberFormat('et-EE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function formatDecimal(value, maximumFractionDigits = 1) {
    if (value == null || Number.isNaN(value)) {
        return 'N/A';
    }

    return new Intl.NumberFormat('et-EE', {
        minimumFractionDigits: 0,
        maximumFractionDigits
    }).format(value);
}

function formatChartLabel(label, granularity) {
    if (granularity === 'hour') {
        return label;
    }

    return formatDateForDisplay(label);
}

function setChartEmptyState(chartElements, message) {
    const { svg, axis, tooltip, empty } = chartElements;
    if (svg) {
        svg.innerHTML = '';
    }
    if (axis) {
        axis.innerHTML = '';
    }
    if (tooltip) {
        tooltip.style.display = 'none';
    }
    if (empty) {
        empty.style.display = 'block';
        empty.textContent = message;
    }
}

function renderTimelineChart({ timeline, svg, axis, tooltip, empty, subtitle, valueKey = 'sessions', valueLabel = 'sessiooni', subtitleTexts = {}, scaleMode = 'linear' }) {
    if (!svg || !axis || !empty || !tooltip) {
        return;
    }

    const points = timeline?.points || [];
    if (points.length === 0) {
        setChartEmptyState({ svg, axis, tooltip, empty }, 'Valitud perioodi kohta graafiku andmeid ei leitud.');
        return;
    }

    empty.style.display = 'none';
    svg.innerHTML = '';
    axis.innerHTML = '';
    tooltip.style.display = 'none';
    if (subtitle) {
        subtitle.textContent = timeline.granularity === 'hour' ?
            (subtitleTexts.hour || 'Valitud päeva väärtused tundide lõikes') :
            (subtitleTexts.day || 'Valitud perioodi väärtused päevade lõikes');
    }

    const width = 640;
    const height = 220;
    const padding = { top: 14, right: 14, bottom: 24, left: 14 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(...points.map((point) => point[valueKey] ?? point.value ?? 0), 1);
    const baselineY = height - padding.bottom;
    const normalizeValue = (rawValue) => {
        const numericValue = Number(rawValue) || 0;
        if (scaleMode === 'sqrt') {
            return Math.sqrt(numericValue);
        }
        return numericValue;
    };
    const normalizedMaxValue = Math.max(...points.map((point) => normalizeValue(point[valueKey] ?? point.value ?? 0)), 1);

    const svgNamespace = 'http://www.w3.org/2000/svg';
    const createSvgElement = (name) => document.createElementNS(svgNamespace, name);

    const chartPoints = points.map((point, index) => {
        const x = padding.left + (points.length === 1 ? innerWidth / 2 : (innerWidth / (points.length - 1)) * index);
        const pointValue = point[valueKey] ?? point.value ?? 0;
        const normalizedValue = normalizeValue(pointValue);
        const y = baselineY - ((normalizedValue / normalizedMaxValue) * innerHeight);
        return { ...point, x, y };
    });

    for (let i = 0; i < 4; i += 1) {
        const y = padding.top + ((innerHeight / 3) * i);
        const line = createSvgElement('line');
        line.setAttribute('x1', padding.left);
        line.setAttribute('x2', width - padding.right);
        line.setAttribute('y1', y);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', 'rgba(21, 49, 39, 0.10)');
        line.setAttribute('stroke-dasharray', '4 6');
        svg.appendChild(line);
    }

    const linePoints = chartPoints.map((point) => `${point.x},${point.y}`).join(' ');
    const areaPoints = `${padding.left},${baselineY} ${linePoints} ${chartPoints[chartPoints.length - 1].x},${baselineY}`;

    const area = createSvgElement('polygon');
    area.setAttribute('points', areaPoints);
    area.setAttribute('fill', 'rgba(31, 122, 91, 0.14)');
    svg.appendChild(area);

    const polyline = createSvgElement('polyline');
    polyline.setAttribute('points', linePoints);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', '#1f7a5b');
    polyline.setAttribute('stroke-width', '3');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(polyline);

    if (chartPoints.length > 1) {
        const meanX = chartPoints.reduce((sum, point) => sum + point.x, 0) / chartPoints.length;
        const meanY = chartPoints.reduce((sum, point) => sum + point.y, 0) / chartPoints.length;
        let numerator = 0;
        let denominator = 0;

        chartPoints.forEach((point) => {
            numerator += (point.x - meanX) * (point.y - meanY);
            denominator += (point.x - meanX) ** 2;
        });

        const slope = denominator === 0 ? 0 : numerator / denominator;
        const intercept = meanY - (slope * meanX);
        const trendStartY = Math.min(Math.max((slope * padding.left) + intercept, padding.top), baselineY);
        const trendEndY = Math.min(Math.max((slope * (width - padding.right)) + intercept, padding.top), baselineY);

        const trendLine = createSvgElement('line');
        trendLine.setAttribute('x1', padding.left);
        trendLine.setAttribute('y1', trendStartY);
        trendLine.setAttribute('x2', width - padding.right);
        trendLine.setAttribute('y2', trendEndY);
        trendLine.setAttribute('stroke', 'rgba(21, 49, 39, 0.35)');
        trendLine.setAttribute('stroke-width', '1.5');
        trendLine.setAttribute('stroke-dasharray', '5 6');
        svg.appendChild(trendLine);
    }

    const hoverLine = createSvgElement('line');
    hoverLine.setAttribute('y1', padding.top);
    hoverLine.setAttribute('y2', baselineY);
    hoverLine.setAttribute('stroke', 'rgba(21, 49, 39, 0.18)');
    hoverLine.setAttribute('stroke-width', '1.5');
    hoverLine.setAttribute('display', 'none');
    svg.appendChild(hoverLine);

    const axisIndexes = Array.from(new Set([
        0,
        Math.floor((points.length - 1) / 3),
        Math.floor(((points.length - 1) * 2) / 3),
        points.length - 1
    ]));

    axisIndexes.forEach((index) => {
        const label = document.createElement('span');
        label.textContent = formatChartLabel(points[index].label, timeline.granularity);
        axis.appendChild(label);
    });

    const updateHover = (event) => {
        const rect = svg.getBoundingClientRect();
        const relativeX = ((event.clientX - rect.left) / rect.width) * width;
        let nearestPoint = chartPoints[0];
        let shortestDistance = Math.abs(relativeX - nearestPoint.x);

        chartPoints.forEach((point) => {
            const distance = Math.abs(relativeX - point.x);
            if (distance < shortestDistance) {
                nearestPoint = point;
                shortestDistance = distance;
            }
        });

        hoverLine.setAttribute('x1', nearestPoint.x);
        hoverLine.setAttribute('x2', nearestPoint.x);
        hoverLine.setAttribute('display', 'block');

        const pointValue = nearestPoint[valueKey] ?? nearestPoint.value ?? 0;
        tooltip.innerHTML = `<strong>${formatChartLabel(nearestPoint.label, timeline.granularity)}</strong><span>${pointValue} ${valueLabel}</span>`;
        tooltip.style.display = 'block';

        const tooltipLeft = (nearestPoint.x / width) * rect.width;
        const tooltipTop = (nearestPoint.y / height) * rect.height;
        const tooltipPadding = 14;
        const tooltipWidth = tooltip.offsetWidth || 120;
        const tooltipHeight = tooltip.offsetHeight || 44;
        const minCenterX = (tooltipWidth / 2) + tooltipPadding;
        const maxCenterX = rect.width - (tooltipWidth / 2) - tooltipPadding;
        const clampedLeft = Math.min(Math.max(tooltipLeft, minCenterX), maxCenterX);
        const clampedTop = Math.max(tooltipTop, tooltipHeight + tooltipPadding);
        tooltip.style.left = `${clampedLeft}px`;
        tooltip.style.top = `${clampedTop}px`;
    };

    svg.onmousemove = updateHover;
    svg.onmouseenter = updateHover;
    svg.onmouseleave = () => {
        hoverLine.setAttribute('display', 'none');
        tooltip.style.display = 'none';
    };
}

function setDashboardStatus(message = '', state = '') {
    if (!dashboardStatus) {
        return;
    }

    dashboardStatus.textContent = message;
    dashboardStatus.className = 'status-banner';

    if (message) {
        dashboardStatus.classList.add('is-visible');
    }

    if (state) {
        dashboardStatus.classList.add(`is-${state}`);
    }
}

function showMetaAuthQueryMessage() {
    const params = new URLSearchParams(window.location.search);
    const authState = params.get('metaAuth');
    const message = params.get('message');

    if (!authState) {
        return;
    }

    if (authState === 'success') {
        setDashboardStatus('Meta ühendus uuendati edukalt.', 'success');
    } else if (authState === 'error') {
        setDashboardStatus(`Meta ühenduse uuendamine ebaõnnestus${message ? `: ${message}` : '.'}`, 'error');
    }

    params.delete('metaAuth');
    params.delete('message');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
}

function showYouTubeAuthQueryMessage() {
    const params = new URLSearchParams(window.location.search);
    const authState = params.get('youtubeAuth');
    const message = params.get('message');

    if (!authState) {
        return;
    }

    if (authState === 'success') {
        setDashboardStatus(`YouTube ühendus uuendati edukalt${message ? `: ${message}` : '.'}`, 'success');
        if (youtubeAuthStatus) {
            youtubeAuthStatus.textContent = 'YouTube kanal ühendatud. Andmed laetakse valitud perioodi järgi.';
        }
    } else if (authState === 'error') {
        setDashboardStatus(`YouTube ühendus ebaõnnestus${message ? `: ${message}` : '.'}`, 'error');
        if (youtubeAuthStatus) {
            youtubeAuthStatus.textContent = 'YouTube ühendus vajab uuesti proovimist.';
        }
    }

    params.delete('youtubeAuth');
    params.delete('message');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
}

async function processMetaOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    const errorReason = params.get('error_description') || params.get('error_message');

    if (!code && !error) {
        return;
    }

    if (error) {
        setDashboardStatus(`Meta ühenduse uuendamine katkestati${errorReason ? `: ${errorReason}` : '.'}`, 'error');
        params.delete('code');
        params.delete('error');
        params.delete('error_description');
        params.delete('error_message');
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
        return;
    }

    setDashboardStatus('Meta ühendust uuendatakse...', 'loading');

    try {
        const response = await fetch(`${META_AUTH_COMPLETE_URL}?code=${encodeURIComponent(code)}`);
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.error || 'Meta ühenduse uuendamine ebaõnnestus.');
        }

        setDashboardStatus('Meta ühendus uuendati edukalt.', 'success');
        await loadMetaAuthStatus();
    } catch (callbackError) {
        console.error('Meta OAuth completion failed:', callbackError);
        setDashboardStatus(`Meta ühenduse uuendamine ebaõnnestus: ${callbackError.message}`, 'error');
    } finally {
        params.delete('code');
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
    }
}

async function loadMetaAuthStatus() {
    if (!metaAuthStatus) {
        return;
    }

    metaAuthStatus.textContent = 'Meta ühenduse olekut laetakse...';
    if (metaTokenBadge) {
        metaTokenBadge.classList.remove('is-visible');
    }
    const fallbackText = 'Meta ühendus aktiivne. Praegune pikk token tuleks käsitsi uuendada enne 07.06.2026.';

    const updateExpiryWarning = (expiresAt) => {
        if (!metaTokenBadge || !expiresAt) {
            return;
        }

        const expiryDate = new Date(expiresAt);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / 86400000);
        if (daysUntilExpiry <= 14) {
            metaTokenBadge.classList.add('is-visible');
        } else {
            metaTokenBadge.classList.remove('is-visible');
        }
    };

    try {
        const response = await fetch(META_AUTH_STATUS_URL);
        const payload = await response.json();

        if (!response.ok) {
            metaAuthStatus.textContent = fallbackText;
            return;
        }

        if (!payload.connected) {
            metaAuthStatus.textContent = fallbackText;
            return;
        }

        const expiresText = payload.expiresAt ?
            formatDateForDisplay(payload.expiresAt.slice(0, 10)) :
            'kuupäev teadmata';
        metaAuthStatus.textContent = `Meta ühendus aktiivne. Uuenda tokenit käsitsi enne ${expiresText}.`;
        updateExpiryWarning(payload.expiresAt);
    } catch (error) {
        console.error('Meta auth status load failed:', error);
        metaAuthStatus.textContent = fallbackText;
    }
}

function setBlogStatus(message = '') {
    if (blogStatus) {
        blogStatus.textContent = message;
    }
}

function renderInsightList(container, items, type) {
    if (!container) {
        return;
    }

    if (!items || items.length === 0) {
        container.innerHTML = `<div class="insight-list-item"><span>${type === 'posts' ? 'Valitud perioodil loetud postitusi ei leitud.' : 'Väliseid viitajaid ei leitud.'}</span><span class="insight-count">0</span></div>`;
        return;
    }

    container.innerHTML = items.map((item) => {
        if (type === 'posts') {
            return `<div class="insight-list-item"><div><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a></div><span class="insight-count">${item.views}</span></div>`;
        }

        return `<div class="insight-list-item"><div><a href="${item.referrer}" target="_blank" rel="noopener noreferrer">${item.referrer}</a><span>lugemisi blogisse</span></div><span class="insight-count">${item.views}</span></div>`;
    }).join('');
}

function renderBlogTopPosts() {
    if (!latestBlogPayload) {
        renderInsightList(blogTopPosts, [], 'posts');
        return;
    }

    const allPosts = latestBlogPayload.allPosts || latestBlogPayload.topPosts || [];
    const visiblePosts = blogTopPostsExpanded ? allPosts : allPosts.slice(0, 3);
    renderInsightList(blogTopPosts, visiblePosts, 'posts');

    if (blogTopPostsHeading) {
        blogTopPostsHeading.textContent = blogTopPostsExpanded ? 'Kõik loetuimad postitused' : 'Top 3 loetuimat postitust';
    }

    if (blogTopPostsToggle) {
        blogTopPostsToggle.textContent = blogTopPostsExpanded ? '← Näita vähem' : '→ Vaata kõiki';
        blogTopPostsToggle.setAttribute('aria-expanded', blogTopPostsExpanded ? 'true' : 'false');
    }
}

function renderMetaTopPostsList(container, items, emptyText = 'Valitud perioodi postitusi ei leitud.') {
    if (!container) {
        return;
    }

    if (!items || items.length === 0) {
        container.innerHTML = `<div class="insight-list-item"><span>${emptyText}</span><span class="insight-count">0</span></div>`;
        return;
    }

    const formatSocialMediaType = (mediaType) => {
        const normalized = String(mediaType || '').toUpperCase();
        if (normalized === 'IMAGE') {
            return 'pilt';
        }
        if (normalized === 'VIDEO') {
            return 'video';
        }
        if (normalized === 'CAROUSEL_ALBUM') {
            return 'karussell';
        }
        if (normalized === 'REELS') {
            return 'reel';
        }
        return normalized ? normalized.toLowerCase() : '';
    };

    container.innerHTML = items.map((item) => {
        const scoreLabel = item.reach != null ? 'reach' : item.views != null ? 'vaatamist' : 'interaktsioone';
        const scoreValue = item.reach != null ? item.reach : item.views != null ? item.views : (item.interactions ?? 0);
        const readableMediaType = formatSocialMediaType(item.mediaType);
        const mediaTypeLabel = readableMediaType ? ` • ${readableMediaType}` : '';
        const metaText = item.publishedAt ? `${formatDateForDisplay(item.publishedAt)}${mediaTypeLabel} • ${scoreLabel}` : `${scoreLabel}${mediaTypeLabel}`;
        return `<div class="insight-list-item"><div><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a><span>${metaText}</span></div><span class="insight-count">${scoreValue}</span></div>`;
    }).join('');
}

function renderFacebookTopPosts() {
    renderMetaTopPostsList(fbTopPosts, latestFacebookTopPosts, 'Valitud perioodi Facebooki postitusi ei leitud.');

    if (fbTopPosts) {
        fbTopPosts.hidden = !facebookTopPostsExpanded;
    }

    if (fbPostCountToggle) {
        fbPostCountToggle.setAttribute('aria-expanded', facebookTopPostsExpanded ? 'true' : 'false');
    }

    if (fbPostCountArrow) {
        fbPostCountArrow.textContent = facebookTopPostsExpanded ? '↓' : '→';
    }
}

function renderInstagramTopPosts() {
    renderMetaTopPostsList(instaTopPosts, latestInstagramTopPosts, 'Valitud perioodi Instagrami sisu ei leitud.');

    if (instaTopPosts) {
        instaTopPosts.hidden = !instagramTopPostsExpanded;
    }

    if (instaPostCountToggle) {
        instaPostCountToggle.setAttribute('aria-expanded', instagramTopPostsExpanded ? 'true' : 'false');
    }

    if (instaPostCountArrow) {
        instaPostCountArrow.textContent = instagramTopPostsExpanded ? '↓' : '→';
    }
}

function renderGoogleReviews() {
    if (!googleReviewsList) {
        return;
    }

    const visibleReviews = googleReviewsExpanded ? latestGoogleReviews : latestGoogleReviews.slice(0, 3);

    if (!latestGoogleReviews || latestGoogleReviews.length === 0) {
        googleReviewsList.innerHTML = `<div class="insight-list-item"><div><strong>Valitud perioodil review'sid ei leitud.</strong><span class="insight-meta">Google arvustused kuvatakse siin, kui neid on saadaval.</span></div><span class="insight-count">0</span></div>`;
    } else {
        googleReviewsList.innerHTML = visibleReviews.map((review) => {
            const reviewText = review.comment && review.comment.trim() ? review.comment.trim() : 'Tekst puudub';
            const reviewDate = review.createTime ? formatDateForDisplay(review.createTime.slice(0, 10)) : 'Kuupäev teadmata';
            const reviewRating = review.starRating != null ? `${formatDecimal(review.starRating, 1)}★` : '—';

            return `<div class="insight-list-item">
                <div>
                    <strong>${review.reviewerName || 'Anonüümne'}</strong>
                    <span class="insight-meta">${reviewDate} • ${reviewText}</span>
                </div>
                <span class="insight-count">${reviewRating}</span>
            </div>`;
        }).join('');
    }

    googleReviewsList.hidden = !googleReviewsExpanded;

    if (googleReviewsToggle) {
        googleReviewsToggle.setAttribute('aria-expanded', googleReviewsExpanded ? 'true' : 'false');
    }

    if (googleReviewsToggleLabel) {
        googleReviewsToggleLabel.textContent = latestGoogleReviews.length === 0 ?
            'Review\'sid pole' :
            (googleReviewsExpanded ? `Näita vähem (${latestGoogleReviews.length})` : `Vaata kõiki (${latestGoogleReviews.length})`);
    }

    if (googleReviewsToggleArrow) {
        googleReviewsToggleArrow.textContent = googleReviewsExpanded ? '↓' : '→';
    }
}

function renderMetaAdsList(container, items, emptyText = 'Valitud perioodi reklaame ei leitud.') {
    if (!container) {
        return;
    }

    if (!items || items.length === 0) {
        container.innerHTML = `<div class="insight-list-item"><span>${emptyText}</span><span class="insight-count">0</span></div>`;
        return;
    }

    container.innerHTML = items.map((item) => {
        const clicksText = `${item.linkClicks || 0} klikki`;
        const spendText = formatCurrency(item.spend || 0);
        const landingPageViewsText = item.landingPageViews != null ? `${item.landingPageViews} LPV` : null;
        const cpcText = item.costPerClick != null ? `${formatCurrency(item.costPerClick)}/klikk` : null;
        const metaParts = [clicksText, spendText, landingPageViewsText, cpcText].filter(Boolean);
        const titleHtml = item.url ?
            `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a>` :
            `<strong>${item.title}</strong>`;

        return `<div class="insight-list-item">
            <div>${titleHtml}<span>${metaParts.join(' • ')}</span></div>
            <span class="insight-count">${item.linkClicks || 0}</span>
        </div>`;
    }).join('');
}

function renderMetaAdsSection() {
    renderMetaAdsList(metaFacebookBoostsList, latestMetaFacebookBoosts, 'Valitud perioodi Facebooki booste ei leitud.');
    renderMetaAdsList(metaInstagramBoostsList, latestMetaInstagramBoosts, 'Valitud perioodi Instagrami booste ei leitud.');
    renderMetaAdsList(metaLinkClicksList, latestMetaLinkClicks, 'Valitud perioodi klikireklaame ei leitud.');

    if (metaFacebookBoostsList) {
        metaFacebookBoostsList.hidden = !metaFacebookBoostsExpanded;
    }
    if (metaInstagramBoostsList) {
        metaInstagramBoostsList.hidden = !metaInstagramBoostsExpanded;
    }
    if (metaLinkClicksList) {
        metaLinkClicksList.hidden = !metaLinkClicksExpanded;
    }

    if (metaFacebookBoostsToggle) {
        metaFacebookBoostsToggle.setAttribute('aria-expanded', metaFacebookBoostsExpanded ? 'true' : 'false');
    }
    if (metaInstagramBoostsToggle) {
        metaInstagramBoostsToggle.setAttribute('aria-expanded', metaInstagramBoostsExpanded ? 'true' : 'false');
    }
    if (metaLinkClicksToggle) {
        metaLinkClicksToggle.setAttribute('aria-expanded', metaLinkClicksExpanded ? 'true' : 'false');
    }

    if (metaFacebookBoostsArrow) {
        metaFacebookBoostsArrow.textContent = metaFacebookBoostsExpanded ? '↓' : '→';
    }
    if (metaInstagramBoostsArrow) {
        metaInstagramBoostsArrow.textContent = metaInstagramBoostsExpanded ? '↓' : '→';
    }
    if (metaLinkClicksArrow) {
        metaLinkClicksArrow.textContent = metaLinkClicksExpanded ? '↓' : '→';
    }
}

function renderSmailyCampaigns() {
    if (!smailyCampaignsList) {
        return;
    }

    if (!latestSmailyCampaigns || latestSmailyCampaigns.length === 0) {
        smailyCampaignsList.innerHTML = `<div class="insight-list-item"><span>Valitud perioodi kampaaniaid ei leitud.</span><span class="insight-count">0</span></div>`;
    } else {
        smailyCampaignsList.innerHTML = latestSmailyCampaigns.map((campaign) => {
            const dateLabel = campaign.completedAt ? formatDateForDisplay(campaign.completedAt.slice(0, 10)) : 'Kuupäev teadmata';
            const metaParts = [
                dateLabel,
                `${campaign.uniqueClickCount || 0} unikaalset klikki`
            ];
            return `<div class="insight-list-item">
                <div><strong>${campaign.name || 'Nimetu kampaania'}</strong><span>${metaParts.join(' • ')}</span></div>
                <span class="insight-count">${campaign.openedCount || 0}</span>
            </div>`;
        }).join('');
    }

    smailyCampaignsList.hidden = !smailyCampaignsExpanded;
    if (smailyCampaignsToggle) {
        smailyCampaignsToggle.setAttribute('aria-expanded', smailyCampaignsExpanded ? 'true' : 'false');
    }
    if (smailyCampaignsArrow) {
        smailyCampaignsArrow.textContent = smailyCampaignsExpanded ? '↓' : '→';
    }
}

function renderSmailyNewSubscribersChart() {
    if (!smailyNewSubscribersChartPanel) {
        return;
    }

    smailyNewSubscribersChartPanel.hidden = !smailyNewSubscribersExpanded;
    if (smailyNewSubscribersToggle) {
        smailyNewSubscribersToggle.setAttribute('aria-expanded', smailyNewSubscribersExpanded ? 'true' : 'false');
    }
    if (smailyNewSubscribersArrow) {
        smailyNewSubscribersArrow.textContent = smailyNewSubscribersExpanded ? '↓' : '→';
    }

    if (!smailyNewSubscribersExpanded) {
        return;
    }

    renderTimelineChart({
        timeline: latestSmailyNewSubscribersTimeline,
        svg: smailyNewSubscribersChart,
        axis: smailyNewSubscribersChartAxis,
        tooltip: smailyNewSubscribersChartTooltip,
        empty: smailyNewSubscribersChartEmpty,
        subtitle: smailyNewSubscribersChartSubtitle,
        valueKey: 'value',
        valueLabel: 'uut tellijat',
        subtitleTexts: {
            day: 'Valitud perioodi liitumised päevade lõikes'
        }
    });
}

function formatInteger(value) {
    return new Intl.NumberFormat('et-EE', { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function renderMediaRankingList(container, items, metricKey, metricLabel, emptyText) {
    if (!container) {
        return;
    }

    if (!items || items.length === 0) {
        container.innerHTML = `<div class="insight-list-item"><span>${emptyText}</span><span class="insight-count">0</span></div>`;
        return;
    }

    container.innerHTML = items.map((item, index) => {
        const title = escapeHtml(item.title || item.name || 'Nimetu');
        const metricValue = item[metricKey] ?? item.value ?? 0;
        const titleHtml = item.url ?
            `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${index + 1}. ${title}</a>` :
            `<strong>${index + 1}. ${title}</strong>`;
        return `<div class="insight-list-item">
            <div>${titleHtml}<span>${formatInteger(metricValue)} ${metricLabel}</span></div>
            <span class="insight-count">${formatInteger(metricValue)}</span>
        </div>`;
    }).join('');
}

function renderMediaPerformanceChart() {
    renderTimelineChart({
        timeline: latestMediaPerformance?.youtube?.timeline,
        svg: mediaPerformanceChart,
        axis: mediaPerformanceChartAxis,
        tooltip: mediaPerformanceChartTooltip,
        empty: mediaPerformanceChartEmpty,
        subtitle: mediaPerformanceChartSubtitle,
        valueKey: 'value',
        valueLabel: 'vaatamist',
        subtitleTexts: {
            day: 'Valitud perioodi vaatamised päevade lõikes'
        }
    });
}

function renderMediaPerformance() {
    const youtubeItems = latestMediaPerformance?.youtube?.videos || [];
    const topYoutubeVideo = youtubeItems[0];
    const youtubeChannelTitle = latestMediaPerformance?.youtube?.channel?.title;

    if (youtubeAuthStatus) {
        youtubeAuthStatus.textContent = latestMediaPerformance?.youtube?.setupRequired ?
            'YouTube kanal vajab ühendamist.' :
            `YouTube kanal: ${youtubeChannelTitle || 'ühendatud kanal'}`;
    }

    if (youtubeTopTitle) {
        youtubeTopTitle.textContent = topYoutubeVideo?.title || 'Andmeid pole';
    }
    if (youtubeTopViews) {
        youtubeTopViews.textContent = topYoutubeVideo ? ` (${formatInteger(topYoutubeVideo.views || 0)})` : '';
    }
    renderMediaRankingList(youtubeVideosList, youtubeItems, 'views', 'vaatamist', 'Valitud perioodi YouTube videosid ei leitud.');

    if (youtubeVideosList) {
        youtubeVideosList.hidden = !youtubeVideosExpanded;
    }
    if (youtubeTopToggle) {
        youtubeTopToggle.setAttribute('aria-expanded', youtubeVideosExpanded ? 'true' : 'false');
    }
    if (youtubeTopArrow) {
        youtubeTopArrow.textContent = youtubeVideosExpanded ? '↓' : '→';
    }

    renderMediaPerformanceChart();
}

function setMediaPerformanceLoadingState() {
    latestMediaPerformance = null;
    youtubeVideosExpanded = false;
    if (youtubeTopTitle) {
        youtubeTopTitle.textContent = 'Laeb andmeid...';
    }
    if (youtubeTopViews) {
        youtubeTopViews.textContent = '';
    }
    renderMediaRankingList(youtubeVideosList, [], 'views', 'vaatamist', 'Laeb YouTube videosid...');
    setChartEmptyState(
        {
            svg: mediaPerformanceChart,
            axis: mediaPerformanceChartAxis,
            tooltip: mediaPerformanceChartTooltip,
            empty: mediaPerformanceChartEmpty
        },
        'Laeb YouTube graafikut...'
    );
}

async function loadMediaPerformanceRange(startDate, endDate) {
    setMediaPerformanceLoadingState();

    try {
        const response = await fetch(`${MEDIA_PERFORMANCE_RANGE_URL}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.error || 'YouTube andmete laadimine ebaõnnestus.');
        }

        latestMediaPerformance = payload;
        renderMediaPerformance();
    } catch (error) {
        console.error('YouTube andmete laadimine ebaõnnestus:', error);
        latestMediaPerformance = {
            youtube: { videos: [], timeline: { granularity: 'day', points: [] } }
        };
        renderMediaPerformance();
        setChartEmptyState(
            {
                svg: mediaPerformanceChart,
                axis: mediaPerformanceChartAxis,
                tooltip: mediaPerformanceChartTooltip,
                empty: mediaPerformanceChartEmpty
            },
            'YouTube andmeühendus pole veel seadistatud.'
        );
    }
}

function setSmailyLoadingState() {
    if (smailyTitleCount) {
        smailyTitleCount.textContent = '';
    }
    if (smailyNewSubscribers) {
        smailyNewSubscribers.textContent = 'Laeb andmeid...';
    }
    if (smailyCampaignCount) {
        smailyCampaignCount.textContent = 'Laeb andmeid...';
    }

    latestSmailyCampaigns = [];
    latestSmailyCampaignClicksTimeline = null;
    latestSmailyNewSubscribersTimeline = null;
    smailyNewSubscribersExpanded = false;
    smailyCampaignsExpanded = false;
    renderSmailyCampaigns();
    renderSmailyNewSubscribersChart();

    setChartEmptyState(
        {
            svg: smailyCampaignClicksChart,
            axis: smailyCampaignClicksChartAxis,
            tooltip: smailyCampaignClicksChartTooltip,
            empty: smailyCampaignClicksChartEmpty,
        },
        'Laeb uudiskirja klikkide graafikut...'
    );

    setChartEmptyState(
        {
            svg: smailyNewSubscribersChart,
            axis: smailyNewSubscribersChartAxis,
            tooltip: smailyNewSubscribersChartTooltip,
            empty: smailyNewSubscribersChartEmpty,
        },
        'Laeb uute tellijate graafikut...'
    );
}

async function loadSmailyRange(startDate, endDate) {
    setSmailyLoadingState();

    try {
        const response = await fetch(`${SMAILY_RANGE_URL}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.error || 'Smaily andmete laadimine ebaõnnestus.');
        }

        if (smailyTitleCount) {
            smailyTitleCount.textContent = payload.activeSubscribers == null ? '' : `(${payload.activeSubscribers})`;
        }
        setRangeMetricValue(smailyNewSubscribers, payload.newSubscribers?.periodCount, 'Andmed puuduvad');
        setRangeMetricValue(smailyCampaignCount, payload.campaigns?.periodCount, 'Andmed puuduvad');

        latestSmailyCampaigns = payload.campaigns?.items || [];
        latestSmailyCampaignClicksTimeline = payload.campaigns?.timeline || null;
        latestSmailyNewSubscribersTimeline = payload.newSubscribers?.timeline || null;
        renderSmailyCampaigns();
        renderSmailyNewSubscribersChart();

        renderTimelineChart({
            timeline: latestSmailyCampaignClicksTimeline,
            svg: smailyCampaignClicksChart,
            axis: smailyCampaignClicksChartAxis,
            tooltip: smailyCampaignClicksChartTooltip,
            empty: smailyCampaignClicksChartEmpty,
            subtitle: smailyCampaignClicksChartSubtitle,
            valueKey: 'value',
            valueLabel: 'avamist',
            subtitleTexts: {
                day: 'Smaily API näitab siin kampaania kogusummat saatmispäeva juures'
            }
        });
    } catch (error) {
        console.error('Smaily andmete laadimine ebaõnnestus:', error);
        if (smailyTitleCount) {
            smailyTitleCount.textContent = '';
        }
        if (smailyNewSubscribers) {
            smailyNewSubscribers.textContent = 'Andmed puuduvad';
        }
        if (smailyCampaignCount) {
            smailyCampaignCount.textContent = 'Andmed puuduvad';
        }
        latestSmailyCampaigns = [];
        latestSmailyCampaignClicksTimeline = null;
        latestSmailyNewSubscribersTimeline = null;
        smailyNewSubscribersExpanded = false;
        smailyCampaignsExpanded = false;
        renderSmailyCampaigns();
        renderSmailyNewSubscribersChart();
        setChartEmptyState(
            {
                svg: smailyCampaignClicksChart,
                axis: smailyCampaignClicksChartAxis,
                tooltip: smailyCampaignClicksChartTooltip,
                empty: smailyCampaignClicksChartEmpty,
            },
            'Uudiskirja klikkide graafiku laadimine ebaõnnestus.'
        );
        setChartEmptyState(
            {
                svg: smailyNewSubscribersChart,
                axis: smailyNewSubscribersChartAxis,
                tooltip: smailyNewSubscribersChartTooltip,
                empty: smailyNewSubscribersChartEmpty,
            },
            'Uute tellijate graafiku laadimine ebaõnnestus.'
        );
    }
}

function renderGoogleBusinessMetricChart() {
    Object.entries(GOOGLE_BUSINESS_METRIC_CONFIG).forEach(([metricKey, config]) => {
        if (config.toggle) {
            config.toggle.setAttribute('aria-expanded', selectedGoogleBusinessMetric === metricKey ? 'true' : 'false');
            const arrow = config.toggle.querySelector('.metric-toggle-arrow');
            if (arrow) {
                arrow.textContent = selectedGoogleBusinessMetric === metricKey ? '↓' : '→';
            }
        }
    });

    if (!googleBusinessChartPanel) {
        return;
    }

    if (!selectedGoogleBusinessMetric || !latestGoogleBusinessPerformance?.timelines?.[selectedGoogleBusinessMetric]) {
        googleBusinessChartPanel.hidden = true;
        return;
    }

    const metricConfig = GOOGLE_BUSINESS_METRIC_CONFIG[selectedGoogleBusinessMetric];
    googleBusinessChartPanel.hidden = false;
    if (googleBusinessChartTitle) {
        googleBusinessChartTitle.textContent = metricConfig.title;
    }

    renderTimelineChart({
        timeline: latestGoogleBusinessPerformance.timelines[selectedGoogleBusinessMetric],
        svg: googleBusinessChart,
        axis: googleBusinessChartAxis,
        tooltip: googleBusinessChartTooltip,
        empty: googleBusinessChartEmpty,
        subtitle: googleBusinessChartSubtitle,
        valueKey: 'value',
        valueLabel: metricConfig.label,
        subtitleTexts: {
            day: 'Valitud perioodi näit päevade lõikes'
        }
    });
}

function getInstagramStoryOwnerOptions() {
    const dynamicOptions = latestInstagramStories
        .map((item) => (item.assignedTo || '').trim())
        .filter(Boolean);

    return Array.from(new Set([...DEFAULT_STORY_OWNER_OPTIONS, ...dynamicOptions]));
}

async function assignInstagramStoryOwner(storyId, assignedTo) {
    const response = await fetch(ASSIGN_INSTAGRAM_STORY_OWNER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            storyId,
            assignedTo
        })
    });

    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || 'Stoori tegija salvestamine ebaõnnestus.');
    }

    return payload;
}

function renderInstagramStories() {
    if (!instaStoriesList) {
        return;
    }

    if (instaStoriesList) {
        instaStoriesList.hidden = !instagramStoriesExpanded;
    }

    if (instaStoryCountToggle) {
        instaStoryCountToggle.setAttribute('aria-expanded', instagramStoriesExpanded ? 'true' : 'false');
    }

    if (instaStoryCountArrow) {
        instaStoryCountArrow.textContent = instagramStoriesExpanded ? '↓' : '→';
    }

    if (!latestInstagramStories || latestInstagramStories.length === 0) {
        instaStoriesList.innerHTML = `<div class="insight-list-item"><div><strong>Valitud perioodil stoorisid ei leitud.</strong><span class="insight-meta">Kui lugu postitati väljaspool aktiivset 24h API-akent enne salvestuse algust, siis seda siin ei kuvata.</span></div><span class="insight-count">0</span></div>`;
        return;
    }

    const ownerOptions = getInstagramStoryOwnerOptions();
    instaStoriesList.innerHTML = latestInstagramStories.map((story) => {
        const currentAssignedTo = (story.assignedTo || '').trim();
        const optionValues = Array.from(new Set([...ownerOptions, ...(currentAssignedTo ? [currentAssignedTo] : [])]));
        const optionsMarkup = [
            `<option value="">Vali tegija</option>`,
            ...optionValues.map((name) => `<option value="${name.replace(/"/g, '&quot;')}"${currentAssignedTo === name ? ' selected' : ''}>${name}</option>`),
            `<option value="${STORY_OWNER_SENTINEL}">Lisa uus nimi...</option>`
        ].join('');

        return `<div class="insight-list-item">
            <div>
                <strong>${story.title || 'Stoori'}</strong>
                <span class="insight-meta">${formatDateTimeForDisplay(story.timestamp)} • ${(story.mediaType || 'IMAGE').toLowerCase()}</span>
                <select class="insight-owner-select" data-story-id="${story.id}">
                    ${optionsMarkup}
                </select>
            </div>
            <span class="insight-count">${story.storyViews != null ? story.storyViews : '-'}</span>
        </div>`;
    }).join('');

    instaStoriesList.querySelectorAll('.insight-owner-select').forEach((select) => {
        select.addEventListener('change', async (event) => {
            const storyId = event.currentTarget.dataset.storyId;
            let nextValue = event.currentTarget.value;

            if (nextValue === STORY_OWNER_SENTINEL) {
                const customName = window.prompt('Sisesta tegija nimi:');
                if (!customName || !customName.trim()) {
                    renderInstagramStories();
                    return;
                }
                nextValue = customName.trim();
            }

            event.currentTarget.disabled = true;
            try {
                await assignInstagramStoryOwner(storyId, nextValue);
                latestInstagramStories = latestInstagramStories.map((story) => {
                    if (story.id !== storyId) {
                        return story;
                    }
                    return {
                        ...story,
                        assignedTo: nextValue
                    };
                });
                renderInstagramStories();
            } catch (assignmentError) {
                console.error('Instagrami stoori tegija salvestamine ebaõnnestus:', assignmentError);
                alert(`Stoori tegija salvestamine ebaõnnestus: ${assignmentError.message}`);
                renderInstagramStories();
            }
        });
    });
}

async function loadBlogInsights(startDate, endDate) {
    const currentRequestId = ++blogInsightsRequestId;

    blogPostsCreated.textContent = '...';
    blogLatestPostTitle.textContent = 'Laeb...';
    blogLatestPostTitle.href = '#';
    blogLatestPostMeta.textContent = 'Laeb statistikat...';
    blogContentCost.textContent = 'Laeb...';
    latestBlogPayload = null;
    renderInsightList(blogTopPosts, [], 'posts');
    renderInsightList(blogReferrers, [], 'referrers');
    setChartEmptyState({ svg: blogReadsChart, axis: blogChartAxis, tooltip: blogChartTooltip, empty: blogChartEmpty }, 'Laeb blogi lugemiste graafikut...');
    setBlogStatus('Laeb blogi andmeid...');

    try {
        const response = await fetch(`${BLOG_INSIGHTS_URL}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
        const payload = await response.json();

        if (currentRequestId !== blogInsightsRequestId) {
            return;
        }

        if (!response.ok) {
            throw new Error(payload.error || 'Blogi andmete laadimine ebaõnnestus.');
        }

        blogPostsCreated.textContent = payload.createdInRange ?? 0;
        const createdPosts = payload.createdInRange ?? 0;
        const totalContentCost = createdPosts * BLOG_POST_COST_EUR;
        blogContentCost.textContent = formatCurrency(totalContentCost);

        if (payload.newestPost) {
            blogLatestPostTitle.textContent = payload.newestPost.title;
            blogLatestPostTitle.href = payload.newestPost.url;
            blogLatestPostMeta.textContent = `${payload.newestPost.publishedAt || 'Kuupäev teadmata'} • ${payload.newestPostViews || 0} lugemist valitud perioodil`;
        } else {
            blogLatestPostTitle.textContent = 'Postitusi ei leitud';
            blogLatestPostTitle.href = '#';
            blogLatestPostMeta.textContent = 'Sitemapis ei olnud postitusi.';
        }

        latestBlogPayload = payload;
        renderBlogTopPosts();
        renderInsightList(blogReferrers, payload.externalReferrers || [], 'referrers');
        renderTimelineChart({
            timeline: payload.timeline,
            svg: blogReadsChart,
            axis: blogChartAxis,
            tooltip: blogChartTooltip,
            empty: blogChartEmpty,
            subtitle: blogChartSubtitle,
            valueKey: 'value',
            valueLabel: 'lugemist',
            scaleMode: 'sqrt',
            subtitleTexts: {
                hour: 'Valitud päeva blogi lugemised tundide lõikes',
                day: 'Valitud perioodi blogi lugemised päevade lõikes'
            }
        });
        setBlogStatus('Blogi ülevaade on laaditud.');
    } catch (error) {
        if (currentRequestId !== blogInsightsRequestId) {
            return;
        }

        console.error('Blogi andmete laadimine ebaõnnestus:', error);
        setChartEmptyState({ svg: blogReadsChart, axis: blogChartAxis, tooltip: blogChartTooltip, empty: blogChartEmpty }, 'Blogi graafiku laadimine ebaõnnestus.');
        blogContentCost.textContent = 'N/A';
        setBlogStatus(`Blogi andmete laadimine ebaõnnestus: ${error.message}`);
    }
}

async function loadGoogleAnalyticsRange(startDate, endDate) {
    const currentRequestId = ++googleRangeRequestId;

    setDashboardStatus(`Laeb Google Analyticsi andmeid perioodi ${formatDateForDisplay(startDate)} kuni ${formatDateForDisplay(endDate)} kohta...`, 'loading');
    googleTotalVisits.textContent = 'Laeb...';
    googlePaidVisits.textContent = 'Laeb...';
    googleOrganicVisits.textContent = 'Laeb...';
    googleAdCost.textContent = 'Laeb...';
    googleCostPerPaidSession.textContent = 'Laeb...';
    googleAverageSessions.textContent = 'Arvutan keskmist sessioonide arvu...';
    setChartEmptyState({ svg: gaSessionsChart, axis: gaChartAxis, tooltip: gaChartTooltip, empty: gaChartEmpty }, 'Laeb sessioonide graafikut...');

    try {
        const response = await fetch(`${GOOGLE_ANALYTICS_RANGE_URL}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
        const payload = await response.json();

        if (currentRequestId !== googleRangeRequestId) {
            return;
        }

        if (!response.ok) {
            throw new Error(payload.error || 'Google Analyticsi andmete laadimine ebaõnnestus.');
        }

        setTextValue(googleTotalVisits, payload.google?.websiteVisitsTotal);
        setTextValue(googlePaidVisits, payload.google?.websiteVisitsPaid);
        setTextValue(googleOrganicVisits, payload.google?.websiteVisitsOrganic);
        googleAdCost.textContent = formatCurrency(payload.google?.googleAdsCost);
        googleCostPerPaidSession.textContent = formatCurrency(payload.google?.costPerPaidSession);
        const averageSessions = (payload.timeline?.points?.length || 0) > 0 ?
            payload.google?.websiteVisitsTotal / payload.timeline.points.length :
            null;
        googleAverageSessions.textContent = averageSessions == null ?
            'Keskmist sessioonide arvu ei saanud arvutada.' :
            `Keskmiselt ${formatDecimal(averageSessions)} sessiooni ${payload.timeline?.granularity === 'hour' ? 'tunnis' : 'päevas'}.`;
        renderTimelineChart({
            timeline: payload.timeline,
            svg: gaSessionsChart,
            axis: gaChartAxis,
            tooltip: gaChartTooltip,
            empty: gaChartEmpty,
            subtitle: gaChartSubtitle,
            valueKey: 'sessions',
            valueLabel: 'sessiooni',
            subtitleTexts: {
                hour: 'Valitud päeva sessioonid tundide lõikes',
                day: 'Valitud perioodi sessioonid päevade lõikes'
            }
        });
        setDashboardStatus('');
    } catch (error) {
        if (currentRequestId !== googleRangeRequestId) {
            return;
        }

        console.error('Google Analyticsi vahemiku laadimine ebaõnnestus:', error);
        setChartEmptyState({ svg: gaSessionsChart, axis: gaChartAxis, tooltip: gaChartTooltip, empty: gaChartEmpty }, 'Graafiku laadimine ebaõnnestus.');
        googleAverageSessions.textContent = 'Keskmist sessioonide arvu ei saanud laadida.';
        setDashboardStatus(`Google Analyticsi andmete laadimine ebaõnnestus: ${error.message}`, 'error');
    }
}

function setGoogleBusinessLoadingState() {
    [
        googleReviewsPeriodNew,
        googleReviewsPeriodRating,
        googleBusinessProfileViews,
        googleBusinessSearchViews,
        googleBusinessMapsViews,
        googleBusinessWebsiteClicks,
        googleBusinessCallClicks,
        googleBusinessDirectionRequests,
    ].forEach((element) => {
        if (element) {
            element.textContent = 'Laeb andmeid...';
        }
    });

    latestGoogleReviews = [];
    googleReviewsExpanded = false;
    renderGoogleReviews();
    latestGoogleBusinessPerformance = null;
    selectedGoogleBusinessMetric = null;
    renderGoogleBusinessMetricChart();
    setChartEmptyState(
        {
            svg: googleReviewsChart,
            axis: googleReviewsChartAxis,
            tooltip: googleReviewsChartTooltip,
            empty: googleReviewsChartEmpty,
        },
        'Laeb Google reviewde graafikut...'
    );

    if (googleReviewsTitleCount) {
        googleReviewsTitleCount.textContent = '';
    }
}

async function loadGoogleBusinessProfileRange(startDate, endDate) {
    setGoogleBusinessLoadingState();

    try {
        const response = await fetch(`${GOOGLE_BUSINESS_PROFILE_RANGE_URL}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
        const payload = await response.json();

        if (!response.ok) {
            const requestError = new Error(payload.error || 'Google Business Profile andmete laadimine ebaõnnestus.');
            requestError.code = payload.code || '';
            throw requestError;
        }

        setRangeMetricValue(googleReviewsPeriodNew, payload.reviews?.periodNewReviews, 'Andmed puuduvad');
        setTextValue(
            googleReviewsPeriodRating,
            payload.reviews?.periodAverageRating == null ? 'Andmed puuduvad' : formatDecimal(payload.reviews.periodAverageRating, 2)
        );
        if (googleReviewsTitleCount) {
            googleReviewsTitleCount.textContent = payload.reviews?.totalReviewCount == null ? '' : `(${payload.reviews.totalReviewCount})`;
        }
        latestGoogleReviews = payload.reviews?.latestReviews || [];
        googleReviewsExpanded = false;
        renderGoogleReviews();
        renderTimelineChart({
            timeline: payload.reviews?.timeline,
            svg: googleReviewsChart,
            axis: googleReviewsChartAxis,
            tooltip: googleReviewsChartTooltip,
            empty: googleReviewsChartEmpty,
            subtitle: googleReviewsChartSubtitle,
            valueKey: 'value',
            valueLabel: 'arvustust',
            subtitleTexts: {
                day: 'Valitud perioodi arvustused päevade lõikes'
            }
        });

        setRangeMetricValue(googleBusinessProfileViews, payload.performance?.profileViews);
        setRangeMetricValue(googleBusinessSearchViews, payload.performance?.searchViews);
        setRangeMetricValue(googleBusinessMapsViews, payload.performance?.mapsViews);
        setRangeMetricValue(googleBusinessWebsiteClicks, payload.performance?.websiteClicks);
        setRangeMetricValue(googleBusinessCallClicks, payload.performance?.callClicks);
        setRangeMetricValue(googleBusinessDirectionRequests, payload.performance?.directionRequests);
        latestGoogleBusinessPerformance = payload.performance || null;
        renderGoogleBusinessMetricChart();
    } catch (error) {
        console.error('Google Business Profile andmete laadimine ebaõnnestus:', error);
        const isGoogleAuthExpired = error.code === 'GOOGLE_BUSINESS_AUTH_EXPIRED' ||
            String(error.message || '').toLowerCase().includes('expired or revoked');
        const fallbackText = isGoogleAuthExpired ? 'Google ühendus aegunud' : 'Andmed puuduvad';
        [
            googleReviewsPeriodNew,
            googleReviewsPeriodRating,
            googleBusinessProfileViews,
            googleBusinessSearchViews,
            googleBusinessMapsViews,
            googleBusinessWebsiteClicks,
            googleBusinessCallClicks,
            googleBusinessDirectionRequests,
        ].forEach((element) => {
            if (element) {
                element.textContent = fallbackText;
            }
        });
        setDashboardStatus(
            isGoogleAuthExpired ?
                'Google Business Profile ühendus on aegunud. Uuenda GBP_REFRESH_TOKEN secret uue Google OAuth refresh tokeniga.' :
                `Google Business Profile andmete laadimine ebaõnnestus: ${error.message}`,
            'error'
        );
        if (googleReviewsTitleCount) {
            googleReviewsTitleCount.textContent = '';
        }
        latestGoogleReviews = [];
        googleReviewsExpanded = false;
        renderGoogleReviews();
        latestGoogleBusinessPerformance = null;
        selectedGoogleBusinessMetric = null;
        renderGoogleBusinessMetricChart();
        setChartEmptyState(
            {
                svg: googleReviewsChart,
                axis: googleReviewsChartAxis,
                tooltip: googleReviewsChartTooltip,
                empty: googleReviewsChartEmpty,
            },
            'Google reviewde graafiku laadimine ebaõnnestus.'
        );
    }
}

function buildStoryUnavailableText(availableSince) {
    return availableSince ?
        `Andmed puuduvad (alates ${formatDateForDisplay(availableSince)})` :
        'Andmed puuduvad';
}

function buildInstagramContentUnavailableText(startDate) {
    if (startDate && startDate < INSTAGRAM_CONTENT_DATA_AVAILABLE_SINCE) {
        return `Andmed puuduvad (alates ${formatDateForDisplay(INSTAGRAM_CONTENT_DATA_AVAILABLE_SINCE)})`;
    }

    return 'Andmed puuduvad';
}

function setMetaLoadingState() {
    [
        fbPostCount,
        fbInteractions,
        fbPageVisits,
        instaNewFollowers,
        instaPostCount,
        instaPostViews,
        instaPageVisits,
        metaFacebookBoostSpend,
        metaInstagramBoostSpend,
        metaLinkClicksTotal,
        metaTotalAdSpend,
    ].forEach((element) => {
        if (element) {
            element.textContent = 'Laeb andmeid...';
        }
    });

    setChartEmptyState(
        {
            svg: fbReachChart,
            axis: fbChartAxis,
            tooltip: fbChartTooltip,
            empty: fbChartEmpty,
        },
        'Laeb Facebooki reach graafikut...'
    );

    setChartEmptyState(
        {
            svg: instaViewsChart,
            axis: instaChartAxis,
            tooltip: instaChartTooltip,
            empty: instaChartEmpty,
        },
        'Laeb Instagrami vaatamiste graafikut...'
    );

    if (metaFacebookBoostsList) {
        metaFacebookBoostsList.innerHTML = `<div class="insight-list-item"><span>Laeb Facebooki booste...</span><span class="insight-count">...</span></div>`;
    }
    if (metaInstagramBoostsList) {
        metaInstagramBoostsList.innerHTML = `<div class="insight-list-item"><span>Laeb Instagrami booste...</span><span class="insight-count">...</span></div>`;
    }
    if (metaLinkClicksList) {
        metaLinkClicksList.innerHTML = `<div class="insight-list-item"><span>Laeb reklaamiklikke...</span><span class="insight-count">...</span></div>`;
    }

    setChartEmptyState(
        {
            svg: metaAdsChart,
            axis: metaAdsChartAxis,
            tooltip: metaAdsChartTooltip,
            empty: metaAdsChartEmpty,
            subtitle: metaAdsChartSubtitle
        },
        'Laeb Meta reklaamikliki graafikut...'
    );
}

async function loadMetaSocialRange(startDate, endDate) {
    const showInstagramNewFollowers = shouldShowInstagramNewFollowers(startDate, endDate);

    if (instaNewFollowersRow) {
        instaNewFollowersRow.style.display = showInstagramNewFollowers ? '' : 'none';
    }

    const previousValues = {
        fbFollowers: fbFollowers.textContent,
        fbPostCount: fbPostCount.textContent,
        fbInteractions: fbInteractions.textContent,
        fbPageVisits: fbPageVisits.textContent,
        instaFollowers: instaFollowers.textContent,
        instaNewFollowers: instaNewFollowers.textContent,
        instaStoryCount: instaStoryCount.textContent,
        instaPostCount: instaPostCount.textContent,
        instaStoryViews: instaStoryViews.textContent,
        instaPostViews: instaPostViews.textContent,
        instaPageVisits: instaPageVisits.textContent,
        metaFacebookBoostSpend: metaFacebookBoostSpend.textContent,
        metaInstagramBoostSpend: metaInstagramBoostSpend.textContent,
        metaLinkClicksTotal: metaLinkClicksTotal.textContent,
        metaTotalAdSpend: metaTotalAdSpend.textContent,
    };

    setMetaLoadingState();
    renderMetaTopPostsList(fbTopPosts, [], 'Laeb Facebooki postitusi...');
    renderMetaTopPostsList(instaTopPosts, [], 'Laeb Instagrami postitusi...');
    latestInstagramStories = [];
    if (instaStoriesList) {
        instaStoriesList.innerHTML = `<div class="insight-list-item"><div><strong>Laeb Instagrami stoorisid...</strong><span class="insight-meta">Valitud perioodi aktiivsed stoorid ja salvestatud ajalugu valmistatakse ette.</span></div><span class="insight-count">...</span></div>`;
    }

    try {
        const response = await fetch(`${META_SOCIAL_RANGE_URL}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.error || 'Meta andmete laadimine ebaõnnestus.');
        }

        setTextValue(
            fbFollowers,
            getMetaFollowerSummaryFromPayload(payload.facebook?.followerSummary, { startDate, endDate }, payload.facebook?.followersEnd)
        );
        setRangeMetricValue(fbPostCount, payload.facebook?.postCount);
        setRangeMetricValue(fbInteractions, payload.facebook?.postEngagements);
        setRangeMetricValue(fbPageVisits, payload.facebook?.pageVisits);
        latestFacebookTopPosts = payload.facebookTopPosts || [];
        renderFacebookTopPosts();
        renderTimelineChart({
            timeline: payload.facebookTimeline,
            svg: fbReachChart,
            axis: fbChartAxis,
            tooltip: fbChartTooltip,
            empty: fbChartEmpty,
            subtitle: fbChartSubtitle,
            valueKey: 'value',
            valueLabel: 'reach',
            subtitleTexts: {
                day: 'Valitud perioodi reach päevade lõikes'
            }
        });

        setTextValue(
            instaFollowers,
            getMetaFollowerSummaryFromPayload(payload.instagram?.followerSummary, { startDate, endDate }, payload.instagram?.followersEnd)
        );
        if (showInstagramNewFollowers) {
            setRangeMetricValue(instaNewFollowers, payload.instagram?.newFollowers, 'Andmed puuduvad');
        } else {
            instaNewFollowers.textContent = '';
        }
        const instaContentUnavailableText = buildInstagramContentUnavailableText(startDate);
        const instaContentValue = payload.instagram?.contentShared;
        const shouldHideInstagramContentValue =
            (startDate && startDate < INSTAGRAM_CONTENT_DATA_AVAILABLE_SINCE) &&
            (instaContentValue == null || instaContentValue === 0);
        setRangeMetricValue(
            instaPostCount,
            shouldHideInstagramContentValue ? null : instaContentValue,
            instaContentUnavailableText
        );
        setRangeMetricValue(instaStoryCount, payload.instagram?.storyCount, buildStoryUnavailableText(payload.instagram?.storyDataAvailableSince));
        latestInstagramStories = payload.instagramStories || [];
        renderInstagramStories();
        setRangeMetricValue(instaStoryViews, payload.instagram?.totalInteractions);
        setRangeMetricValue(instaPostViews, payload.instagram?.totalViews);
        setRangeMetricValue(instaPageVisits, payload.instagram?.pageVisits);
        latestInstagramTopPosts = payload.instagramTopPosts || [];
        renderInstagramTopPosts();

        metaFacebookBoostSpend.textContent = payload.metaAds?.facebookBoostSpend == null ? 'Andmed puuduvad' : formatCurrency(payload.metaAds.facebookBoostSpend);
        metaInstagramBoostSpend.textContent = payload.metaAds?.instagramBoostSpend == null ? 'Andmed puuduvad' : formatCurrency(payload.metaAds.instagramBoostSpend);
        metaLinkClicksTotal.textContent = payload.metaAds?.linkClicksTotal == null ? 'Andmed puuduvad' : String(payload.metaAds.linkClicksTotal);
        metaTotalAdSpend.textContent = payload.metaAds?.totalAdSpend == null ? 'Andmed puuduvad' : formatCurrency(payload.metaAds.totalAdSpend);
        latestMetaFacebookBoosts = payload.metaAds?.facebookBoosts || [];
        latestMetaInstagramBoosts = payload.metaAds?.instagramBoosts || [];
        latestMetaLinkClicks = payload.metaAds?.linkClicks || [];
        renderMetaAdsSection();
        renderTimelineChart({
            timeline: payload.metaAds?.linkClicksTimeline,
            svg: metaAdsChart,
            axis: metaAdsChartAxis,
            tooltip: metaAdsChartTooltip,
            empty: metaAdsChartEmpty,
            subtitle: metaAdsChartSubtitle,
            valueKey: 'value',
            valueLabel: 'klikki',
            subtitleTexts: {
                day: 'Valitud perioodi lingiklikid päevade lõikes'
            }
        });
        renderTimelineChart({
            timeline: payload.instagramTimeline,
            svg: instaViewsChart,
            axis: instaChartAxis,
            tooltip: instaChartTooltip,
            empty: instaChartEmpty,
            subtitle: instaChartSubtitle,
            valueKey: 'value',
            valueLabel: 'vaatamist',
            subtitleTexts: {
                day: 'Valitud perioodi vaatamised päevade lõikes'
            }
        });
    } catch (error) {
        console.error('Meta andmete laadimine ebaõnnestus:', error);
        fbFollowers.textContent = previousValues.fbFollowers;
        fbPostCount.textContent = previousValues.fbPostCount;
        fbInteractions.textContent = previousValues.fbInteractions;
        fbPageVisits.textContent = previousValues.fbPageVisits;
        instaFollowers.textContent = previousValues.instaFollowers;
        instaNewFollowers.textContent = showInstagramNewFollowers ? previousValues.instaNewFollowers : '';
        instaStoryCount.textContent = previousValues.instaStoryCount;
        latestInstagramStories = [];
        renderInstagramStories();
        instaPostCount.textContent = previousValues.instaPostCount;
        instaStoryViews.textContent = previousValues.instaStoryViews;
        instaPostViews.textContent = previousValues.instaPostViews;
        instaPageVisits.textContent = previousValues.instaPageVisits;
        metaFacebookBoostSpend.textContent = previousValues.metaFacebookBoostSpend;
        metaInstagramBoostSpend.textContent = previousValues.metaInstagramBoostSpend;
        metaLinkClicksTotal.textContent = previousValues.metaLinkClicksTotal;
        metaTotalAdSpend.textContent = previousValues.metaTotalAdSpend;
        latestMetaFacebookBoosts = [];
        latestMetaInstagramBoosts = [];
        latestMetaLinkClicks = [];
        renderMetaAdsSection();
        setChartEmptyState(
            {
                svg: metaAdsChart,
                axis: metaAdsChartAxis,
                tooltip: metaAdsChartTooltip,
                empty: metaAdsChartEmpty,
                subtitle: metaAdsChartSubtitle
            },
            'Meta reklaamikliki graafiku laadimine ebaõnnestus.'
        );
        setChartEmptyState(
            {
                svg: fbReachChart,
                axis: fbChartAxis,
                tooltip: fbChartTooltip,
                empty: fbChartEmpty,
            },
            'Facebooki reach graafiku laadimine ebaõnnestus.'
        );
        setChartEmptyState(
            {
                svg: instaViewsChart,
                axis: instaChartAxis,
                tooltip: instaChartTooltip,
                empty: instaChartEmpty,
            },
            'Instagrami graafiku laadimine ebaõnnestus.'
        );
    }
}


// Funktsioon kasutaja väljalogimiseks
async function logoutUser() {
    try {
        await signOut(auth);
        console.log('Kasutaja edukalt välja logitud!');
        // UI uuendatakse onAuthStateChanged poolt
    } catch (error) {
        console.error('Väljalogimisviga:', error.message);
        authError.textContent = 'Väljalogimine ebaõnnestus.';
    }
}

// Funktsioon Google'iga sisselogimiseks
async function loginWithGoogle() {
    authError.textContent = ''; // Puhasta veateade
    googleLoginButton.disabled = true;
    googleLoginButton.textContent = 'Avan Google sisselogimist...';
    const provider = new GoogleAuthProvider();
    try {
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error('Google sisselogimisviga:', error.message);
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth, provider);
            return;
        }

        let errorMessage = 'Google sisselogimine ebaõnnestus.';
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sisselogimise aken suleti.';
        } else if (error.code === 'auth/cancelled-popup-request') {
             errorMessage = 'Eelmine sisselogimise aken on juba avatud.';
        } else if (error.code === 'auth/unauthorized-domain') {
            errorMessage = 'See domeen pole Firebase Auth seadetes lubatud.';
        }
        authError.textContent = errorMessage;
    } finally {
        googleLoginButton.disabled = false;
        googleLoginButton.textContent = 'Logi sisse (Google)';
    }
}

async function completeGoogleRedirectLogin() {
    try {
        const result = await getRedirectResult(auth);
        if (result) {
            console.log('Edukalt sisse logitud Google redirectiga!');
        }
    } catch (error) {
        console.error('Google redirect sisselogimisviga:', error.message);
        authError.textContent = 'Google sisselogimine ebaõnnestus.';
    }
}

completeGoogleRedirectLogin();

// Funktsioon andmete lugemiseks Firestore'ist ja kuvamiseks
async function fetchAndDisplayMarketingData(selectedFilter = {}) {
    try {
        let allMarketingData;

        // Kui cache on tühi, loeme kõik andmed Firestore'ist
        if (marketingDataCache.length === 0 || marketingDataDailyCache.length === 0) {
            const monthlyQuery = query(collection(db, "marketingData"), orderBy("date", "asc"));
            const monthlySnapshot = await getDocs(monthlyQuery);

            allMarketingData = monthlySnapshot.docs.map(doc => doc.data());
            marketingDataCache = allMarketingData;

            if (marketingDataDailyCache.length === 0) {
                try {
                    const dailyQuery = query(collection(db, "marketingDataDaily"), orderBy("date", "asc"));
                    const dailySnapshot = await getDocs(dailyQuery);
                    marketingDataDailyCache = dailySnapshot.docs.map(doc => doc.data());
                } catch (dailyError) {
                    console.warn('Päevaste Meta snapshotide lugemine ebaõnnestus, kasutan fallback-loogikat.', dailyError);
                    marketingDataDailyCache = [];
                }
            }
        } else {
            allMarketingData = marketingDataCache; // Kasuta cache'itud andmeid
        }
        
        let currentMonthData = {}; // Kasutame seda arvutuste alusena
        let previousMonthData = {}; // Eelmise perioodi võrdlusandmed

        // --- Kuupäevavahemiku filtreerimine ja agregeerimine ---
        if (selectedFilter.startDate && selectedFilter.endDate) {
            const startDate = new Date(selectedFilter.startDate + "T00:00:00"); // Lisa aeg, et vältida ajavööndi probleeme
            const endDate = new Date(selectedFilter.endDate + "T23:59:59"); // Lõppkuupäeva viimane hetk
            
            const selectedMonthKeys = getSelectedMonthKeys(selectedFilter.startDate, selectedFilter.endDate);

            // Firestore'i sotsiaalandmed on kuupõhised snapshotid, seega võtame valitud vahemikust
            // kõik kuud, mille sisse valitud periood langeb.
            const filteredData = allMarketingData.filter(item => {
                return selectedMonthKeys.includes(getMonthKey(item.date));
            });

            if (filteredData.length === 0) {
                console.warn('Antud kuupäevavahemikus andmeid ei leitud.');
                clearMainMetricsWithFallback('N/A');
                setSelectedRangeLabel(selectedFilter.startDate, selectedFilter.endDate, selectedFilter.label || 'Valitud vahemik');
                await Promise.all([
                    loadGoogleAnalyticsRange(selectedFilter.startDate, selectedFilter.endDate),
                    loadBlogInsights(selectedFilter.startDate, selectedFilter.endDate),
                    loadMetaSocialRange(selectedFilter.startDate, selectedFilter.endDate),
                    loadSmailyRange(selectedFilter.startDate, selectedFilter.endDate),
                    loadMediaPerformanceRange(selectedFilter.startDate, selectedFilter.endDate),
                    loadGoogleBusinessProfileRange(selectedFilter.startDate, selectedFilter.endDate)
                ]);
                return;
            }

            // --- Agregeerimine ---
            const aggregatedData = filteredData.reduce((acc, item) => {
                // Liida Google Analytics
                acc.google.websiteVisitsTotal += item.google?.websiteVisitsTotal || 0;
                acc.google.websiteVisitsPaid += item.google?.websiteVisitsPaid || 0;
                acc.google.websiteVisitsOrganic += item.google?.websiteVisitsOrganic || 0;
                acc.google.totalReviews += item.google?.totalReviews || 0; 

                // Liida Facebook
                acc.facebook.adSpend += item.facebook?.adSpend || 0;
                acc.facebook.storyCount += item.facebook?.storyCount || 0;
                acc.facebook.postCount += item.facebook?.postCount || 0;
                acc.facebook.storyViews += item.facebook?.storyViews || 0;
                acc.facebook.postViews += item.facebook?.postViews || 0;
                acc.facebook.pageVisits += item.facebook?.pageVisits || 0;
                acc.facebook.postEngagements += item.facebook?.postEngagements || 0;

                // Liida Instagram
                acc.instagram.adSpend += item.instagram?.adSpend || 0;
                acc.instagram.storyCount += item.instagram?.storyCount || 0;
                acc.instagram.postCount += item.instagram?.postCount || 0;
                acc.instagram.storyViews += item.instagram?.storyViews || 0;
                acc.instagram.postViews += item.instagram?.postViews || 0;
                acc.instagram.pageVisits += item.instagram?.pageVisits || 0;
                acc.instagram.totalInteractions += item.instagram?.totalInteractions || 0;
                acc.instagram.newFollowers += item.instagram?.newFollowers || 0;

                // Liida Newsletter
                return acc;
            }, {
                google: { websiteVisitsTotal: 0, websiteVisitsPaid: 0, websiteVisitsOrganic: 0, reviewsRating: 0, totalReviews: 0 },
                facebook: { followersEnd: 0, adSpend: 0, storyCount: 0, postCount: 0, storyViews: 0, postViews: 0, pageVisits: 0, postEngagements: 0 },
                instagram: { followersEnd: 0, adSpend: 0, storyCount: 0, postCount: 0, storyViews: 0, postViews: 0, pageVisits: 0, totalInteractions: 0, newFollowers: 0 },
                newsletter: { subscribers: 0 },
                date: 'Aggregated' // Märgime, et see on agregeeritud
            });

            // Mõned väljad peaksid olema perioodi lõpu väärtused
            if (filteredData.length > 0) {
                const lastItem = filteredData[filteredData.length - 1];
                aggregatedData.facebook.followersEnd = lastItem.facebook?.followersEnd || 0;
                aggregatedData.instagram.followersEnd = lastItem.instagram?.followersEnd || 0;
                aggregatedData.newsletter.subscribers = lastItem.newsletter?.subscribers || 0;
                aggregatedData.google.reviewsRating = lastItem.google?.reviewsRating || 0; // Viimase kuu hinne
            }
            currentMonthData = aggregatedData; // Agregeeritud andmed on nüüd currentMonthData
            setSelectedRangeLabel(selectedFilter.startDate, selectedFilter.endDate, selectedFilter.label || 'Valitud vahemik');

            // Perioodi kasvuks peame võrdlema perioodi alguse ja perioodi lõpu jälgijate arvu
            // Leiame perioodi alguse andmed
            const firstItemBeforePeriod = allMarketingData.filter(item => new Date(item.date + "T00:00:00") < startDate).pop();
            if (firstItemBeforePeriod) {
                previousMonthData = firstItemBeforePeriod;
            } else {
                // Kui periood algab esimese kuuga või varem, võtame andmed enne esimest dokumenti
                // (ehk siis eeldame 0 jälgijat alguses)
                previousMonthData = {
                    facebook: { followersEnd: 0 },
                    instagram: { followersEnd: 0 },
                    google: { totalReviews: 0 }
                };
            }

        } else {
            console.warn('Ajavahemik puudub.');
            clearMainMetricsWithFallback('N/A');
            return;
        }


        if (!currentMonthData) {
              console.warn('Käesoleva kuu andmeid ei leitud kuvamiseks.');
            clearMainMetricsWithFallback('N/A');
            return;
        }

        // --- Google Analytics ---
        setTextValue(googleTotalVisits, currentMonthData.google?.websiteVisitsTotal);
        setTextValue(googlePaidVisits, currentMonthData.google?.websiteVisitsPaid);
        setTextValue(googleOrganicVisits, currentMonthData.google?.websiteVisitsOrganic);
        googleAdCost.textContent = formatCurrency(currentMonthData.google?.googleAdsCost);
        googleCostPerPaidSession.textContent = formatCurrency(currentMonthData.google?.costPerPaidSession);

        // --- Facebook & Instagram ---
        // Range-vaates tulevad Meta platvormide näidud alati live range-endpointist.
        // Ära kuva siin vanu kuusnapshotte, sest need võivad jätta vale mulje
        // (näiteks pika perioodi puhul "viimase nädala" followeri või reachi seis).
        metaFacebookBoostSpend.textContent = 'Andmed puuduvad';
        metaInstagramBoostSpend.textContent = 'Andmed puuduvad';
        metaLinkClicksTotal.textContent = 'Andmed puuduvad';
        metaTotalAdSpend.textContent = 'Andmed puuduvad';

        // --- Smaily ---
        setSmailyLoadingState();

        // --- Google Reviews & Business Profile ---
        setGoogleBusinessLoadingState();

        if (selectedFilter.startDate && selectedFilter.endDate) {
            await Promise.all([
                loadGoogleAnalyticsRange(selectedFilter.startDate, selectedFilter.endDate),
                loadBlogInsights(selectedFilter.startDate, selectedFilter.endDate),
                loadMetaSocialRange(selectedFilter.startDate, selectedFilter.endDate),
                loadSmailyRange(selectedFilter.startDate, selectedFilter.endDate),
                loadMediaPerformanceRange(selectedFilter.startDate, selectedFilter.endDate),
                loadGoogleBusinessProfileRange(selectedFilter.startDate, selectedFilter.endDate)
            ]);
        } else {
            googleRangeRequestId += 1;
            setDashboardStatus('');
        }


    } catch (error) {
        console.error('Viga turundusandmete lugemisel:', error);
        clearMainMetricsWithFallback('Viga!');
    }
}



// Listener, mis jälgib autentimise oleku muutusi
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Kasutaja on sisse logitud
        userStatus.textContent = `Sisse logitud kui: ${user.email}`; // See on debugimiseks
        userEmailDisplay.textContent = user.email; // Kuvame e-posti armatuurlaual

        googleLoginButton.style.display = 'none';
        authError.textContent = '';
        authContainer.style.display = 'none'; // Peida sisselogimisvorm

        logoutButton.style.display = 'inline-block'; // Näita väljalogimisnuppu
        dashboardContent.style.display = 'block'; // Näita armatuurlaua sisu

        // Lae andmed, kui kasutaja on sisse logitud
        // Kui monthSelector on juba täidetud (st cache on täidetud),
        // siis kutsu fetchAndDisplayMarketingData välja monthSelector.value'ga
        applyRangeSelection(getPresetDateRange('current-month'));

    } else {
        // Kasutaja on välja logitud
        userStatus.textContent = 'Pole sisse logitud.'; // See on debugimiseks
        userEmailDisplay.textContent = 'külaline';

        googleLoginButton.style.display = 'inline-block';
        authError.textContent = '';
        authContainer.style.display = 'block'; // Näita sisselogimisvorm

        logoutButton.style.display = 'none'; // Peida väljalogimisnupp
        dashboardContent.style.display = 'none'; // Peida armatuurlaua sisu
    }
});

// Lisame nupudele sündmuste kuulajad
googleLoginButton.addEventListener('click', loginWithGoogle); // Google'i sisselogimise kuulaja
logoutButton.addEventListener('click', logoutUser);

applyDateRangeButton.addEventListener('click', () => {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    if (startDate && endDate) {
        if (startDate > endDate) {
            authError.textContent = 'Alguskuupäev ei saa olla hilisem kui lõppkuupäev.';
            return;
        }
        authError.textContent = '';
        applyRangeSelection({ startDate, endDate, label: 'Valitud vahemik' });
    } else {
        authError.textContent = 'Palun vali algus- ja lõppkuupäev.';
    }
});

presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
        authError.textContent = '';
        applyRangeSelection(getPresetDateRange(button.dataset.rangePreset));
        if (mobileRangePreset) {
            mobileRangePreset.value = button.dataset.rangePreset;
        }
    });
});

if (mobileRangePreset) {
    mobileRangePreset.addEventListener('change', (event) => {
        if (!event.target.value) {
            return;
        }

        authError.textContent = '';
        applyRangeSelection(getPresetDateRange(event.target.value));
    });
}

if (blogTopPostsToggle) {
    blogTopPostsToggle.addEventListener('click', () => {
        blogTopPostsExpanded = !blogTopPostsExpanded;
        renderBlogTopPosts();
    });
}

if (fbPostCountToggle) {
    fbPostCountToggle.addEventListener('click', () => {
        facebookTopPostsExpanded = !facebookTopPostsExpanded;
        renderFacebookTopPosts();
    });
}

if (instaStoryCountToggle) {
    instaStoryCountToggle.addEventListener('click', () => {
        instagramStoriesExpanded = !instagramStoriesExpanded;
        renderInstagramStories();
    });
}

if (instaPostCountToggle) {
    instaPostCountToggle.addEventListener('click', () => {
        instagramTopPostsExpanded = !instagramTopPostsExpanded;
        renderInstagramTopPosts();
    });
}

if (googleReviewsToggle) {
    googleReviewsToggle.addEventListener('click', () => {
        googleReviewsExpanded = !googleReviewsExpanded;
        renderGoogleReviews();
    });
}

if (metaFacebookBoostsToggle) {
    metaFacebookBoostsToggle.addEventListener('click', () => {
        metaFacebookBoostsExpanded = !metaFacebookBoostsExpanded;
        renderMetaAdsSection();
    });
}

if (metaInstagramBoostsToggle) {
    metaInstagramBoostsToggle.addEventListener('click', () => {
        metaInstagramBoostsExpanded = !metaInstagramBoostsExpanded;
        renderMetaAdsSection();
    });
}

if (metaLinkClicksToggle) {
    metaLinkClicksToggle.addEventListener('click', () => {
        metaLinkClicksExpanded = !metaLinkClicksExpanded;
        renderMetaAdsSection();
    });
}

if (smailyNewSubscribersToggle) {
    smailyNewSubscribersToggle.addEventListener('click', () => {
        smailyNewSubscribersExpanded = !smailyNewSubscribersExpanded;
        renderSmailyNewSubscribersChart();
    });
}

if (smailyCampaignsToggle) {
    smailyCampaignsToggle.addEventListener('click', () => {
        smailyCampaignsExpanded = !smailyCampaignsExpanded;
        renderSmailyCampaigns();
    });
}

if (youtubeTopToggle) {
    youtubeTopToggle.addEventListener('click', () => {
        youtubeVideosExpanded = !youtubeVideosExpanded;
        renderMediaPerformance();
    });
}

Object.entries(GOOGLE_BUSINESS_METRIC_CONFIG).forEach(([metricKey, config]) => {
    if (config.toggle) {
        config.toggle.addEventListener('click', () => {
            selectedGoogleBusinessMetric = selectedGoogleBusinessMetric === metricKey ? null : metricKey;
            renderGoogleBusinessMetricChart();
        });
    }
});

showMetaAuthQueryMessage();
showYouTubeAuthQueryMessage();
processMetaOAuthCallback().then(() => loadMetaAuthStatus());
completeGoogleRedirectLogin();


console.log("Firebase Authentication on initsialiseeritud ja valmis!");




            
