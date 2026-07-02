const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const app = express();

// Configuration Constants
const API_NAME = "Code Craft Car Info API";
const API_VERSION = "v1.0.0";
const DEVELOPER = "@username_506";
const CREDIT = "@username_506";

// Security & Header Middleware
app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Powered-By', 'Code Craft');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    next();
});

// Helper: Normalize Search Query
const normalizeString = (str) => {
    if (!str) return '';
    return str.replace(/[^A-Z0-9]/ig, '').toUpperCase().trim();
};

// Helper: Safely Manage Statistics (Vercel Ready)
const getStatsPath = () => {
    return process.env.VERCEL ? path.join(os.tmpdir(), 'stats.json') : path.join(__dirname, '../stats.json');
};

const updateStatistics = async (isSearchSuccessful, ip, responseTimeMs) => {
    const statsPath = getStatsPath();
    let stats;

    try {
        const data = await fs.readFile(statsPath, 'utf8');
        stats = JSON.parse(data);
    } catch (error) {
        // Fallback to root stats.json if /tmp is empty
        try {
            const rootStats = await fs.readFile(path.join(__dirname, '../stats.json'), 'utf8');
            stats = JSON.parse(rootStats);
        } catch (e) {
            return; // Fail silently on catastrophic FS errors to prevent server crash
        }
    }

    const now = new Date();
    if (!stats.server_start_time) stats.server_start_time = now.toISOString();

    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    stats.total_requests++;
    stats.last_request_time = now.toISOString();

    if (isSearchSuccessful) {
        stats.total_vehicle_searches++;
        stats.last_search_time = now.toISOString();
    }

    if (!stats.ips) stats.ips = [];
    let isNewUser = false;
    if (!stats.ips.includes(ip)) {
        stats.ips.push(ip);
        stats.total_unique_users++;
        isNewUser = true;
    }

    if (!stats.daily_stats) stats.daily_stats = {};
    if (!stats.daily_stats[todayStr]) stats.daily_stats[todayStr] = { requests: 0, new_users: 0 };
    
    stats.daily_stats[todayStr].requests++;
    if (isNewUser) stats.daily_stats[todayStr].new_users++;

    const todayReq = stats.daily_stats[todayStr]?.requests || 0;
    const yesterdayReq = stats.daily_stats[yesterdayStr]?.requests || 0;
    const todayUsers = stats.daily_stats[todayStr]?.new_users || 0;
    const yesterdayUsers = stats.daily_stats[yesterdayStr]?.new_users || 0;

    stats.today_requests = todayReq;
    stats.today_new_users = todayUsers;
    stats.last_2_days_requests = todayReq + yesterdayReq;
    stats.last_2_days_new_users = todayUsers + yesterdayUsers;

    if (!stats.average_response_time) stats.average_response_time = responseTimeMs;
    else stats.average_response_time = ((stats.average_response_time * (stats.total_requests - 1)) + responseTimeMs) / stats.total_requests;

    try {
        await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));
    } catch (err) {
        // Ignore read-only system errors
    }
};

// GET: /api/carinfo
app.get('/api/carinfo', async (req, res) => {
    const startTime = process.hrtime();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const timestamp = new Date().toISOString();

    const sendResponse = async (status, isSuccess, dataOrMessage) => {
        const diff = process.hrtime(startTime);
        const responseTimeMs = (diff[0] * 1000 + diff[1] / 1e6);
        const responseTimeStr = responseTimeMs.toFixed(2) + 'ms';

        await updateStatistics(isSuccess && status === 200, clientIp, responseTimeMs);

        const responseObj = {
            success: isSuccess,
            api_name: API_NAME,
            api_version: API_VERSION,
            developer: DEVELOPER,
            credit: CREDIT,
            status: "Online",
            timestamp: timestamp,
            response_time: responseTimeStr
        };

        if (isSuccess) responseObj.data = dataOrMessage;
        else responseObj.message = dataOrMessage;

        return res.status(status).json(responseObj);
    };

    try {
        const rawNumber = req.query.number;
        
        if (!rawNumber) {
            return await sendResponse(400, false, "Please provide vehicle number.");
        }

        const searchNumber = normalizeString(rawNumber);
        
        const dbPath = path.join(__dirname, '../database.json');
        const dbContent = await fs.readFile(dbPath, 'utf8');
        const database = JSON.parse(dbContent);

        const vehicle = database.find(car => normalizeString(car.registration_number) === searchNumber);

        if (!vehicle) {
            return await sendResponse(404, false, "Vehicle not found.");
        }

        return await sendResponse(200, true, vehicle);

    } catch (error) {
        return await sendResponse(500, false, "Internal Server Error");
    }
});

module.exports = app;
