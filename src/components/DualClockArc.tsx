"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";

type Props = {
  myName: string;
  partnerName: string;
  user1City?: string | null;
  user1Tz?: string | null;
  user2City?: string | null;
  user2Tz?: string | null;
  reunionDate?: number | null;
  onUpdateLocations?: (u1City: string, u1Tz: string, u2City: string, u2Tz: string) => void;
};

// World city coordinates and estimates for distance calculations
const CITY_DATA: Record<string, { tz: string; lat: number; lon: number; weather: string; temp: number }> = {
  "New York": { tz: "America/New_York", lat: 40.71, lon: -74.0, weather: "☀️", temp: 22 },
  "London": { tz: "Europe/London", lat: 51.5, lon: -0.12, weather: "🌧️", temp: 15 },
  "Paris": { tz: "Europe/Paris", lat: 48.85, lon: 2.35, weather: "⛅", temp: 18 },
  "Mumbai": { tz: "Asia/Kolkata", lat: 19.07, lon: 72.87, weather: "🌙", temp: 28 },
  "Delhi": { tz: "Asia/Kolkata", lat: 28.61, lon: 77.2, weather: "✨", temp: 26 },
  "Tokyo": { tz: "Asia/Tokyo", lat: 35.67, lon: 139.65, weather: "🌸", temp: 20 },
  "Sydney": { tz: "Australia/Sydney", lat: -33.86, lon: 151.2, weather: "☀️", temp: 24 },
  "Toronto": { tz: "America/Toronto", lat: 43.65, lon: -79.38, weather: "⛅", temp: 19 },
  "San Francisco": { tz: "America/Los_Angeles", lat: 37.77, lon: -122.41, weather: "🌫️", temp: 17 },
  "Singapore": { tz: "Asia/Singapore", lat: 1.35, lon: 103.81, weather: "🌴", temp: 31 },
  "Dubai": { tz: "Asia/Dubai", lat: 25.2, lon: 55.27, weather: "✨", temp: 32 },
  "Seoul": { tz: "Asia/Seoul", lat: 37.56, lon: 126.97, weather: "🌙", temp: 21 },
};

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function formatTzTime(d: Date, tz?: string | null): string {
  if (tz) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(d);
    } catch {
      // Fall back to local browser time zone
    }
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return d.toLocaleTimeString();
  }
}

export default function DualClockArc({
  myName,
  partnerName,
  user1City = null,
  user1Tz = null,
  user2City = null,
  user2Tz = null,
  reunionDate,
  onUpdateLocations,
}: Props) {
  const [time, setTime] = useState(new Date());
  const [isDeskMode, setIsDeskMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [city1, setCity1] = useState(user1City || "New York");
  const [city2, setCity2] = useState(user2City || "Paris");

  const isConfigured = Boolean(user1City || user2City);

  useEffect(() => {
    if (user1City) setCity1(user1City);
    if (user2City) setCity2(user2City);
  }, [user1City, user2City]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const c1Data = CITY_DATA[city1] || CITY_DATA["New York"];
  const c2Data = CITY_DATA[city2] || CITY_DATA["Paris"];

  const effectiveTz1 = user1Tz || c1Data.tz;
  const effectiveTz2 = user2Tz || c2Data.tz;

  const distanceKm = useMemo(() => {
    return calculateDistanceKm(c1Data.lat, c1Data.lon, c2Data.lat, c2Data.lon);
  }, [c1Data, c2Data]);

  // Format times safely
  const timeStr1 = useMemo(() => {
    return formatTzTime(time, effectiveTz1);
  }, [time, effectiveTz1]);

  const timeStr2 = useMemo(() => {
    return formatTzTime(time, effectiveTz2);
  }, [time, effectiveTz2]);

  const daysUntilReunion = useMemo(() => {
    if (!reunionDate) return null;
    const diff = reunionDate - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [reunionDate]);

  function handleSaveLocations() {
    setIsEditing(false);
    onUpdateLocations?.(city1, c1Data.tz, city2, c2Data.tz);
  }

  // Projection for the map arc: map lon (-180..180) to x (20..380), lat (-60..70) to y (120..20)
  const mapWidth = 360;
  const mapHeight = 120;
  const pt1 = {
    x: ((c1Data.lon + 180) / 360) * mapWidth,
    y: ((70 - c1Data.lat) / 130) * mapHeight,
  };
  const pt2 = {
    x: ((c2Data.lon + 180) / 360) * mapWidth,
    y: ((70 - c2Data.lat) / 130) * mapHeight,
  };

  const midX = (pt1.x + pt2.x) / 2;
  const midY = Math.min(pt1.y, pt2.y) - 35;
  const arcPath = `M ${pt1.x} ${pt1.y} Q ${midX} ${midY} ${pt2.x} ${pt2.y}`;

  const deskModeElement = isDeskMode && typeof document !== "undefined" ? (
    createPortal(
      <div className="desk-ambient-overlay">
        <button
          type="button"
          className="desk-ambient-close"
          onClick={() => setIsDeskMode(false)}
          title="Exit Desk Mode"
        >
          ✕ Exit Desk Mode
        </button>

        <div className="desk-ambient-stars" aria-hidden="true" />

        <div className="desk-ambient-content">
          <p className="desk-ambient-sub">STUDY & WORK COMPANION · JUST THE TWO OF US</p>

          <div className="desk-clocks-wrap">
            <div className="desk-clock-card">
              <span className="desk-city-tag">{city1} · {c1Data.weather} {c1Data.temp}°C</span>
              <h2 className="desk-time">{timeStr1}</h2>
              <p className="desk-person">{myName}</p>
            </div>

            <div className="desk-center-pulse">
              <span className="desk-pulse-heart">♥</span>
              <span className="desk-distance">{distanceKm.toLocaleString()} km apart</span>
              {daysUntilReunion !== null && (
                <span className="desk-countdown-badge">{daysUntilReunion} days until we reunite ✈️</span>
              )}
            </div>

            <div className="desk-clock-card">
              <span className="desk-city-tag">{city2} · {c2Data.weather} {c2Data.temp}°C</span>
              <h2 className="desk-time">{timeStr2}</h2>
              <p className="desk-person">{partnerName}</p>
            </div>
          </div>

          <p className="desk-ambient-quote">
            “No matter how many miles lie between us, we are looking at the exact same moon.”
          </p>
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <>
      {deskModeElement}
      <div className="dual-clock-widget">
      <div className="dual-clock-head">
        <div className="widget-title-wrap">
          <span className="widget-icon">🌍</span>
          <div>
            <h3>Dual Timezone & Weather Arc</h3>
            <p className="widget-sub">Live distance & ambient companion</p>
          </div>
        </div>

        <div className="widget-head-actions">
          <button
            type="button"
            className="widget-pill-btn"
            onClick={() => setIsEditing((v) => !v)}
            title="Change Cities"
          >
            {isEditing ? "Done" : "Change Cities"}
          </button>
          <button
            type="button"
            className="widget-desk-mode-btn"
            onClick={() => setIsDeskMode(true)}
            title="Open Ambient Fullscreen Desk Mode"
          >
            🖥️ Desk Mode
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="dual-clock-edit-panel">
          <div className="edit-city-group">
            <label>Your City ({myName}):</label>
            <select value={city1} onChange={(e) => setCity1(e.target.value)}>
              {Object.keys(CITY_DATA).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="edit-city-group">
            <label>{partnerName}&apos;s City:</label>
            <select value={city2} onChange={(e) => setCity2(e.target.value)}>
              {Object.keys(CITY_DATA).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="edit-save-btn" onClick={handleSaveLocations}>
            Save
          </button>
        </div>
      )}

      {/* Clocks Row or Empty State */}
      {!isConfigured && !isEditing ? (
        <div style={{ padding: "36px 20px", textAlign: "center" }}>
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>🌍</div>
          <h4 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginBottom: "6px" }}>
            Set your cities & time zones
          </h4>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", maxWidth: "340px", margin: "0 auto 16px", lineHeight: 1.4 }}>
            Choose where you and {partnerName} are located to see each other&apos;s live time, weather, and distance apart.
          </p>
          <button
            type="button"
            className="widget-pill-btn"
            onClick={() => setIsEditing(true)}
            style={{ padding: "8px 22px", borderRadius: "999px", background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            Set your dates & cities
          </button>
        </div>
      ) : (
        <>
          <div className="dual-clocks-row">
            <div className="clock-col">
              <div className="clock-city">
                <span>{city1}</span>
                <span className="weather-badge">
                  {c1Data.weather} {c1Data.temp}°C
                </span>
              </div>
              <div className="clock-time">{timeStr1}</div>
              <div className="clock-user">{myName}</div>
            </div>

            <div className="clock-center">
              <div className="clock-distance-badge">
                <span className="distance-icon">⚡</span>
                <span>{distanceKm.toLocaleString()} km</span>
              </div>
              {daysUntilReunion !== null && (
                <div className="reunion-pill">
                  ✈️ {daysUntilReunion} {daysUntilReunion === 1 ? "day" : "days"} to reunion
                </div>
              )}
            </div>

            <div className="clock-col right">
              <div className="clock-city">
                <span className="weather-badge">
                  {c2Data.weather} {c2Data.temp}°C
                </span>
                <span>{city2}</span>
              </div>
              <div className="clock-time">{timeStr2}</div>
              <div className="clock-user">{partnerName}</div>
            </div>
          </div>

          {/* Interactive Glowing Map Arc */}
          <div className="globe-arc-container">
            <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="globe-arc-svg" aria-hidden="true">
              <defs>
                <linearGradient id="arcGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ff4d94" />
                  <stop offset="50%" stopColor="#ffb3c4" />
                  <stop offset="100%" stopColor="#ef5f86" />
                </linearGradient>
                <filter id="glowBlur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Dotted World Grid Lines */}
              <path
                d="M 10 30 Q 180 20 350 30 M 10 60 Q 180 50 350 60 M 10 90 Q 180 80 350 90"
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="3 4"
                fill="none"
              />

              {/* Glowing Flight Arc */}
              <path d={arcPath} stroke="rgba(255, 77, 148, 0.25)" strokeWidth="4" fill="none" />
              <path
                d={arcPath}
                stroke="url(#arcGlow)"
                strokeWidth="1.8"
                strokeDasharray="5 3"
                className="arc-flight-path"
                filter="url(#glowBlur)"
                fill="none"
              />

              {/* Location 1 Marker */}
              <circle cx={pt1.x} cy={pt1.y} r="5" fill="#ff2e88" filter="url(#glowBlur)" />
              <circle cx={pt1.x} cy={pt1.y} r="2" fill="#fff" />
              <text x={pt1.x} y={pt1.y + 14} fill="rgba(255,255,255,0.7)" fontSize="8.5" textAnchor="middle">
                {city1}
              </text>

              {/* Location 2 Marker */}
              <circle cx={pt2.x} cy={pt2.y} r="5" fill="#ef5f86" filter="url(#glowBlur)" />
              <circle cx={pt2.x} cy={pt2.y} r="2" fill="#fff" />
              <text x={pt2.x} y={pt2.y + 14} fill="rgba(255,255,255,0.7)" fontSize="8.5" textAnchor="middle">
                {city2}
              </text>
            </svg>
          </div>
        </>
      )}
    </div>
    </>
  );
}
