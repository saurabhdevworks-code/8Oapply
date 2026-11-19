import React from 'react';
import linkedinLogo from '../../assets/logos/linkedin.png';
import naukriLogo from '../../assets/logos/naukri.png';
import indeedLogo from '../../assets/logos/indeed.png';
import glassdoorLogo from '../../assets/logos/glassdoor.png';
import internshalaLogo from '../../assets/logos/internshala.png';
import shineLogo from '../../assets/logos/shine.png';
import founditLogo from '../../assets/logos/foundit.png';
import timesjobsLogo from '../../assets/logos/timesjobs.png';
import wellfoundLogo from '../../assets/logos/wellfound.svg';

const LOGO_MAP = {
  linkedin: linkedinLogo,
  naukri: naukriLogo,
  indeed: indeedLogo,
  glassdoor: glassdoorLogo,
  internshala: internshalaLogo,
  shine: shineLogo,
  foundit: founditLogo,
  timesjobs: timesjobsLogo,
};

export default function PlatformLogo({ id, name, className = "w-11 h-11", style }) {
  const key = (id || name || '').toLowerCase();
    // Clean, unified reduced border-radius (3px) everywhere
  const cleanClassName = className.replace(/\brounded(-[a-z0-9\[\]]+)?\b/g, '').trim();
  const radiusClass = 'rounded-[3px]';

  if (key === 'others' || key === 'google') {
    return (
      <div style={style} className={`${cleanClassName} shrink-0 ${radiusClass} bg-white border border-slate-200 dark:border-slate-800 p-1 flex items-center justify-center shadow-xs overflow-hidden`}>
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
        </svg>
      </div>
    );
  }

  if (key === 'gmail') {
    return (
      <div style={style} className={`${cleanClassName} shrink-0 ${radiusClass} bg-white border border-slate-200 dark:border-slate-800 p-1 flex items-center justify-center shadow-xs overflow-hidden`}>
        <svg viewBox="0 49.4 512 399.42" className="w-full h-full">
          <path fill="#4285F4" d="M34.91 448.818h81.454V251L0 163.727V413.91c0 19.287 15.622 34.91 34.91 34.91z" />
          <path fill="#34A853" d="M395.636 448.818h81.455c19.287 0 34.909-15.622 34.909-34.909V163.727L395.636 251z" />
          <path fill="#FBBC05" d="M395.636 99.727V251L512 163.727v-46.545c0-43.142-49.25-67.782-83.782-41.891z" />
          <path fill="#EA4335" d="M116.364 251V99.727L256 204.455 395.636 99.727V251L256 355.727z" />
          <path fill="#C5221F" d="M0 117.182v46.545L116.364 251V99.727L83.782 75.291C49.25 49.4 0 74.04 0 117.18z" />
        </svg>
      </div>
    );
  }

  if (key === 'wellfound') {
    return (
      <div style={style} className={`${cleanClassName} shrink-0 ${radiusClass} bg-black p-1 flex items-center justify-center shadow-xs overflow-hidden`}>
        <img
          src={wellfoundLogo}
          alt="Wellfound"
          className="w-full h-full object-contain brightness-0 invert"
        />
      </div>
    );
  }

  const src = LOGO_MAP[key];
  if (src) {
    return (
      <img
        src={src}
        alt={key}
        style={style}
        className={`${cleanClassName} shrink-0 ${radiusClass} object-cover shadow-xs`}
      />
    );
  }

  return (
    <div style={style} className={`${cleanClassName} shrink-0 ${radiusClass} bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs`}>
      {(key || 'JB').substring(0, 2).toUpperCase()}
    </div>
  );
}
