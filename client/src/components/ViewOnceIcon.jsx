export default function ViewOnceIcon({ size = 18 }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path
                d="M2.5 12s3.4-6.5 9.5-6.5S21.5 12 21.5 12s-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.8" />
            <text
                x="12"
                y="13.2"
                textAnchor="middle"
                fontSize="7.2"
                fontWeight="700"
                fill="currentColor"
                fontFamily="Inter, system-ui, sans-serif"
            >
                1
            </text>
        </svg>
    );
}
