import { useId } from "react";

// Stickers editoriales del diseño de referencia (EditorialStickers.jsx), trasladados con las mismas
// geometrías, colores y proporciones. Son decorativos: aria-hidden y sin interacción de puntero.
// El tamaño responsivo (w-24 → sm:w-28, etc.) vive en styles/stickers.css.

const envoltorio = (clase) => `sticker ${clase}`;

/** Sello circular tipográfico (Vanderbilt). La letra central es la inicial de la marca. */
export function SelloCircular({ className = "", letra = "P", texto = "· patrimonio · memoria · territorio" }) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={`sticker sticker--seal ${className}`} aria-hidden="true">
      <svg viewBox="0 0 140 140" focusable="false">
        <defs>
          <path id={`sello-${id}`} d="M 70, 70 m -48, 0 a 48,48 0 1,1 96,0 a 48,48 0 1,1 -96,0" />
        </defs>
        <circle cx="70" cy="70" r="62" fill="rgba(255, 255, 255, 0.72)" stroke="#E4E4E1" strokeWidth="1" />
        <text fill="#6F8576" fontSize="9.2" fontWeight="500" letterSpacing="2.4">
          <textPath href={`#sello-${id}`} startOffset="0%">
            {texto}
          </textPath>
        </text>
        <text x="70" y="83" textAnchor="middle" fill="#5C5C59" fontFamily="Cinzel, serif" fontSize="34" fontWeight="500">
          {letra}
        </text>
      </svg>
    </div>
  );
}

/** Doodle minimalista de mascota (Moonlight). */
export function PatitoDoodle({ className = "" }) {
  return (
    <div className={envoltorio(`sticker--duck ${className}`)} aria-hidden="true">
      <svg viewBox="0 0 72 64" focusable="false">
        <path
          d="M22 48 C16 48 14 40 17 31 C19 24 21 15 24 12 C26 10 29 12 29 16 C29 19 28 22 28 24 C34 24 42 29 44 37 C46 44 41 48 33 48 Z"
          fill="#FFFFFF" stroke="#5C5C59" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
        <path d="M27 24 C35 23 44 26 45 31 C45 35 36 36 28 34 Z" fill="#EAD89A" stroke="#5C5C59" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="24" cy="21" r="1.6" fill="#5C5C59" />
        <path d="M50 47 L50 44 M54 47 L54 44 M58 47 L58 44 M62 47 L62 44" stroke="#5C5C59" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Sticker voxel «abeja» troquelado con contorno blanco. */
export function AbejaVoxel({ className = "" }) {
  return (
    <div className={envoltorio(`sticker--bee ${className}`)} aria-hidden="true">
      <svg viewBox="0 0 130 110" focusable="false">
        <g stroke="#FFFFFF" strokeWidth="9" strokeLinejoin="round">
          <polygon points="48,22 92,10 104,24 62,38" fill="#FFFFFF" />
          <rect x="28" y="34" width="58" height="42" rx="6" fill="#FFFFFF" />
        </g>
        <polygon points="52,24 94,12 104,22 64,36" fill="#E1E8F0" stroke="#BDCAD9" strokeWidth="1" />
        <rect x="30" y="36" width="54" height="38" rx="4" fill="#EAD89A" />
        <rect x="44" y="36" width="10" height="38" fill="#8C7458" />
        <rect x="64" y="36" width="10" height="38" fill="#8C7458" />
        <rect x="30" y="48" width="8" height="8" fill="#5C5C59" />
        <rect x="32" y="48" width="3" height="3" fill="#8C9EB2" />
        <rect x="22" y="42" width="8" height="3" fill="#6E6E6B" />
        <rect x="22" y="54" width="8" height="3" fill="#6E6E6B" />
        <rect x="42" y="74" width="4" height="7" fill="#6E6E6B" />
        <rect x="56" y="74" width="4" height="7" fill="#6E6E6B" />
        <rect x="70" y="74" width="4" height="7" fill="#6E6E6B" />
      </svg>
    </div>
  );
}

/** Sticker voxel «exploradores» troquelado. */
export function ExploradoresVoxel({ className = "" }) {
  return (
    <div className={envoltorio(`sticker--explorers ${className}`)} aria-hidden="true">
      <svg viewBox="0 0 140 125" focusable="false">
        <g stroke="#FFFFFF" strokeWidth="10" strokeLinejoin="round" fill="#FFFFFF">
          <rect x="30" y="24" width="26" height="26" rx="3" />
          <rect x="26" y="50" width="34" height="34" rx="3" />
          <rect x="30" y="84" width="26" height="28" rx="3" />
          <rect x="74" y="28" width="26" height="26" rx="3" />
          <rect x="70" y="54" width="34" height="34" rx="3" />
          <rect x="74" y="88" width="26" height="26" rx="3" />
        </g>
        <rect x="30" y="24" width="26" height="26" rx="2" fill="#D9B89C" />
        <rect x="30" y="24" width="26" height="7" fill="#7D6857" />
        <rect x="26" y="50" width="34" height="34" rx="2" fill="#9BB8BD" />
        <rect x="30" y="84" width="26" height="28" rx="2" fill="#7B8FA6" />
        <rect x="74" y="28" width="26" height="26" rx="2" fill="#E3C4A8" />
        <rect x="74" y="28" width="26" height="9" fill="#C98A63" />
        <rect x="70" y="54" width="34" height="34" rx="2" fill="#D99E86" />
        <rect x="74" y="88" width="26" height="26" rx="2" fill="#636870" />
      </svg>
    </div>
  );
}

/** Sticker cubo / tótem voxel decorativo. */
export function TotemVoxel({ className = "" }) {
  return (
    <div className={envoltorio(`sticker--totem ${className}`)} aria-hidden="true">
      <svg viewBox="0 0 84 96" focusable="false">
        <g stroke="#FFFFFF" strokeWidth="8" strokeLinejoin="round" fill="#FFFFFF">
          <rect x="22" y="16" width="40" height="40" rx="4" />
          <rect x="30" y="56" width="24" height="24" rx="3" />
        </g>
        <rect x="22" y="16" width="40" height="40" rx="3" fill="#9DBFA6" />
        <rect x="28" y="26" width="9" height="9" fill="#5C5C59" />
        <rect x="47" y="26" width="9" height="9" fill="#5C5C59" />
        <rect x="37" y="35" width="10" height="14" fill="#5C5C59" />
        <rect x="30" y="56" width="24" height="24" rx="2" fill="#B5CEBC" />
        <rect x="39" y="60" width="6" height="14" fill="#C99684" />
      </svg>
    </div>
  );
}
