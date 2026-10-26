(() => {
    const svg = `<svg class="st-bang-tree" viewBox="0 0 300 220" role="img" aria-hidden="true" focusable="false">
        <path d="M190 205c-6-34-7-69-4-103h19c-4 37-2 69 5 103z" fill="#8b5a3c"/>
        <path d="M197 137l-35-35m43 27 38-38m-46 64-47-5" fill="none" stroke="#8b5a3c" stroke-width="9" stroke-linecap="round"/>
        <g fill="#176b4d">
            <path d="M34 83c2-22 29-37 57-31 8-23 48-28 65-9 20-15 56-5 60 18 28-4 48 14 43 36 20 17 6 47-21 47H60c-31 0-45-34-26-53z"/>
            <path d="M63 49c10-20 40-26 58-11 14-24 52-24 67-3 21-16 53-3 51 20 26 3 39 26 27 45H49c-18-20-10-44 14-51z" fill="#21835e"/>
            <path d="M99 29c15-19 45-20 59-3 17-18 48-11 53 10 24-3 40 15 34 34H77c-4-19 7-35 22-41z" fill="#36a06d"/>
        </g>
        <g fill="#d95d39">
            <path d="M70 169c10-11 18-13 27-10-5 11-13 17-25 17z"/>
            <path d="M116 190c8-12 16-16 26-14-3 12-10 19-22 21z"/>
            <path d="M251 165c-11-8-20-9-29-4 7 10 16 14 28 12z"/>
            <path d="M91 188l-4 13m40-17-2 13m124-38 5 12" fill="none" stroke="#d95d39" stroke-width="3" stroke-linecap="round"/>
        </g>
        <ellipse cx="196" cy="207" rx="53" ry="7" fill="#0b4b38" opacity=".12"/>
    </svg>`;
    window.StudentBangTree = Object.freeze({ render: () => svg });
})();
