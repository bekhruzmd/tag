export default function CampusArt() {
  return (
    <svg className="campus-art" viewBox="0 0 760 720" aria-hidden="true">
      <defs>
        <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
          <path
            d="M 36 0 L 0 0 0 36"
            fill="none"
            stroke="#374035"
            strokeWidth=".5"
          />
        </pattern>
        <radialGradient id="glow">
          <stop stopColor="#8db24d" stopOpacity=".14" />
          <stop offset="1" stopColor="#8db24d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="760" height="720" fill="#1b241c" />
      <rect width="760" height="720" fill="url(#grid)" />
      <g transform="rotate(-19 380 360)">
        <path
          d="M-100 144H850M-100 342H850M-100 560H850M170 -100V820M412 -100V820M650 -100V820"
          stroke="#333d31"
          strokeWidth="31"
        />
        <path
          d="M-100 144H850M-100 342H850M-100 560H850M170 -100V820M412 -100V820M650 -100V820"
          stroke="#5b6551"
          strokeWidth="1"
          strokeDasharray="5 9"
        />
        <g fill="#2e392b" stroke="#4b5840" strokeWidth="1.5">
          <path d="M215 189h131v89H215zM459 190h142v44H459zM459 249h71v50h-71zM53 186h73v107H53zM211 392h145v44H211zM283 436h73v74h-73zM458 387h142v115H458zM37 387h95v120H37zM208 607h150v91H208zM457 601h74v103h-74zM541 601h63v73h-63zM209 14h149v82H209zM461 27h142v76H461z" />
        </g>
        <g fill="#425236" opacity=".55">
          {Array.from({ length: 18 }, (_, i) => (
            <circle
              key={i}
              cx={196 + (i % 6) * 32}
              cy={468 + Math.floor(i / 6) * 25}
              r="8"
            />
          ))}
          <ellipse cx="550" cy="100" rx="50" ry="12" />
        </g>
        <g
          fill="#99a38a"
          fontFamily="monospace"
          fontSize="10"
          letterSpacing="2"
        >
          <text x="220" y="327">
            UNIVERSITY PLACE
          </text>
          <text x="466" y="451">
            THE QUAD
          </text>
          <text x="222" y="243">
            LIBRARY
          </text>
        </g>
      </g>
      <circle cx="388" cy="362" r="330" fill="url(#glow)" />
      <circle
        cx="388"
        cy="362"
        r="249"
        fill="#b1e75b"
        fillOpacity=".035"
        stroke="#bcf35a"
        strokeOpacity=".6"
        strokeWidth="1.5"
      />
      <circle
        cx="388"
        cy="362"
        r="172"
        fill="none"
        stroke="#c5f45c"
        strokeOpacity=".4"
        strokeDasharray="6 8"
      />
      <path
        d="M397 405L357 367L367 318L414 291"
        fill="none"
        stroke="#cbf887"
        strokeOpacity=".55"
        strokeWidth="2"
        strokeDasharray="3 7"
      />
      <g transform="translate(397 405)">
        <circle r="24" fill="#c5f45c" fillOpacity=".1" />
        <circle r="14" fill="#c5f45c" fillOpacity=".2" />
        <circle r="6" fill="#c5f45c" stroke="#efffcf" strokeWidth="2" />
      </g>
      <g transform="translate(286 284)">
        <circle r="17" fill="#ee9b66" fillOpacity=".13" />
        <circle r="5" fill="#f0ac7e" />
        <path
          d="M-25 0h8M17 0h8M0 -25v8M0 17v8"
          stroke="#f0ac7e"
          strokeWidth="1.5"
        />
      </g>
      <g transform="translate(497 327)">
        <circle r="17" fill="#ee9b66" fillOpacity=".13" />
        <circle r="5" fill="#f0ac7e" />
      </g>
      <g fill="#c5f45c" fontFamily="monospace" fontSize="10" letterSpacing="2">
        <text x="413" y="410">
          YOU
        </text>
        <text x="334" y="101">
          SAFE ZONE
        </text>
      </g>
    </svg>
  );
}
