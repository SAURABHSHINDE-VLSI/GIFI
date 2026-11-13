const HEARTS = [
  { left: "6%", delay: "0s", duration: "21s", size: "13px" },
  { left: "17%", delay: "3.5s", duration: "26s", size: "9px" },
  { left: "29%", delay: "9s", duration: "23s", size: "15px" },
  { left: "41%", delay: "1.5s", duration: "28s", size: "10px" },
  { left: "53%", delay: "13s", duration: "24s", size: "12px" },
  { left: "64%", delay: "6s", duration: "27s", size: "9px" },
  { left: "76%", delay: "11s", duration: "22s", size: "14px" },
  { left: "88%", delay: "4s", duration: "29s", size: "11px" },
  { left: "95%", delay: "16s", duration: "25s", size: "9px" },
];

export default function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      {HEARTS.map((heart, index) => (
        <span
          key={index}
          className="float-heart"
          style={{
            left: heart.left,
            animationDelay: heart.delay,
            animationDuration: heart.duration,
            fontSize: heart.size,
          }}
        >
          ♥
        </span>
      ))}
    </div>
  );
}
