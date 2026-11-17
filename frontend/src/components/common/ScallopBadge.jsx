import React from 'react';

/**
 * Scalloped Check Badge component matching the user's reference:
 * - Connected: Solid Filled Green (#17aa4d) with crisp bold white checkmark
 * - Not connected: Without fill grey (hollow grey outline) with grey checkmark
 */
export default function ScallopBadge({ connected = false, className = "w-5 h-5", title }) {
  const badgeTitle = title || (connected ? "Connected" : "Not Connected");

  return (
    <svg
      viewBox="0 0 100 100"
      className={`${className} shrink-0 transition-transform duration-200`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={badgeTitle}
    >
      <title>{badgeTitle}</title>

      {/* 16-point smooth scalloped rosette */}
      <path
        d="M 95.00 50.00 C 95.00 52.28, 84.90 53.96, 84.33 56.83 C 83.76 59.70, 92.45 65.12, 91.57 67.22 C 90.70 69.32, 80.73 67.01, 79.10 69.44 C 77.48 71.88, 83.43 80.21, 81.82 81.82 C 80.21 83.43, 71.88 77.48, 69.44 79.10 C 67.01 80.73, 69.32 90.70, 67.22 91.57 C 65.12 92.45, 59.70 83.76, 56.83 84.33 C 53.96 84.90, 52.28 95.00, 50.00 95.00 C 47.72 95.00, 46.04 84.90, 43.17 84.33 C 40.30 83.76, 34.88 92.45, 32.78 91.57 C 30.68 90.70, 32.99 80.73, 30.56 79.10 C 28.12 77.48, 19.79 83.43, 18.18 81.82 C 16.57 80.21, 22.52 71.88, 20.90 69.44 C 19.27 67.01, 9.30 69.32, 8.43 67.22 C 7.55 65.12, 16.24 59.70, 15.67 56.83 C 15.10 53.96, 5.00 52.28, 5.00 50.00 C 5.00 47.72, 15.10 46.04, 15.67 43.17 C 16.24 40.30, 7.55 34.88, 8.43 32.78 C 9.30 30.68, 19.27 32.99, 20.90 30.56 C 22.52 28.12, 16.57 19.79, 18.18 18.18 C 19.79 16.57, 28.12 22.52, 30.56 20.90 C 32.99 19.27, 30.68 9.30, 32.78 8.43 C 34.88 7.55, 40.30 16.24, 43.17 15.67 C 46.04 15.10, 47.72 5.00, 50.00 5.00 C 52.28 5.00, 53.96 15.10, 56.83 15.67 C 59.70 16.24, 65.12 7.55, 67.22 8.43 C 69.32 9.30, 67.01 19.27, 69.44 20.90 C 71.88 22.52, 80.21 16.57, 81.82 18.18 C 83.43 19.79, 77.48 28.12, 79.10 30.56 C 80.73 32.99, 90.70 30.68, 91.57 32.78 C 92.45 34.88, 83.76 40.30, 84.33 43.17 C 84.90 46.04, 95.00 47.72, 95.00 50.00 Z"
        fill={connected ? "#17aa4d" : "none"}
        stroke={connected ? "#149543" : "#94a3b8"}
        strokeWidth={connected ? "2" : "5.5"}
      />

      {/* Internal Bold Checkmark */}
      <path
        d="M 30 50 L 44 64 L 70 36"
        stroke={connected ? "#ffffff" : "#94a3b8"}
        strokeWidth={connected ? "8" : "6"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
