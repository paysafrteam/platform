import { Globe } from "lucide-react";

function InstagramMark() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r=".75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SocialLinks({ onDark = false }: { onDark?: boolean }) {
  const text = onDark ? "text-white/75" : "text-[var(--ps-grey-600)]";
  const items = [
    {
      label: "X",
      value: "@usepaysafr",
      icon: <span aria-hidden="true">𝕏</span>,
    },
    { label: "Instagram", value: "@usepaysafr", icon: <InstagramMark /> },
    {
      label: "Website",
      value: "usepaysafr.com",
      icon: <Globe size={16} aria-hidden="true" />,
    },
  ];

  return (
    <div className={`flex flex-wrap gap-x-5 gap-y-3 text-sm ${text}`}>
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex max-w-full items-center gap-2"
        >
          {item.icon}
          <span className="min-w-0 break-all">
            <span className="sr-only">{item.label}: </span>
            {item.value}
          </span>
        </span>
      ))}
    </div>
  );
}
