const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const app = express();

const API_NAME = "Code Craft Car Info API";
const API_VERSION = "v1.0.0";
const DEVELOPER = "@username_506";
const CREDIT = "@username_505";

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

const getStatsPath = () => {
    return process.env.VERCEL ? path.join(os.tmpdir(), 'stats.json') : path.join(__dirname, '../stats.json');
};

const calculateUptime = (startDate) => {
    if (!startDate) return "0h 0m 0s";
    const start = new Date(startDate);
    const now = new Date();
    const diffMs = now - start;
    
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    const s = Math.floor((diffMs % 60000) / 1000);
    
    return `${h}h ${m}m ${s}s`;
};

app.get('/api/status', async (req, res) => {
    const startTime = process.hrtime();
    const timestamp = new Date().toISOString();
    
    try {
        const statsPath = getStatsPath();
        let stats;
        
        try {
            const data = await fs.readFile(statsPath, 'utf8');
            stats = JSON.parse(data);
        } catch (error) {
            const rootStats = await fs.readFile(path.join(__dirname, '../stats.json'), 'utf8');
            stats = JSON.parse(rootStats);
        }

        const dbPath = path.join(__dirname, '../database.json');
        const dbContent = await fs.readFile(dbPath, 'utf8');
        const database = JSON.parse(dbContent);

        const diff = process.hrtime(startTime);
        const responseTimeMs = (diff[0] * 1000 + diff[1] / 1e6);

        res.status(200).json({
            success: true,
            api_name: API_NAME,
            api_version: API_VERSION,
            developer: DEVELOPER,
            credit: CREDIT,
            status: "Online",
            uptime: calculateUptime(stats.server_start_time),
            server_start_time: stats.server_start_time || timestamp,
            timestamp: timestamp,
            response_time: responseTimeMs.toFixed(2) + 'ms',
            statistics: {
                total_requests: stats.total_requests || 0,
                total_unique_users: stats.total_unique_users || 0,
                total_vehicle_searches: stats.total_vehicle_searches || 0,
                today_requests: stats.today_requests || 0,
                today_new_users: stats.today_new_users || 0,
                last_2_days_requests: stats.last_2_days_requests || 0,
                last_2_days_new_users: stats.last_2_days_new_users || 0,
                database_records: database.length || 50,
                last_search_time: stats.last_search_time || "N/A",
                last_request_time: stats.last_request_time || "N/A",
                average_response_time: stats.average_response_time ? stats.average_response_time.toFixed(2) + 'ms' : '0ms'
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            api_name: API_NAME,
            api_version: API_VERSION,
            developer: DEVELOPER,
            credit: CREDIT,
            status: "Online",
            timestamp: timestamp,
            response_time: "0ms",
            message: "Internal Server Error"
        });
    }
});

module.exports = app;
