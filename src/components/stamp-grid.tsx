export function StampGrid({ stamps }: { stamps: number }) {
  return (
    <ol
      className="grid grid-cols-5 gap-3"
      aria-label={`${stamps} of 10 stamps`}
    >
      {Array.from({ length: 10 }, (_, index) => {
        const number = index + 1;
        const earned = number <= stamps;
        const reward = number === 5 ? "10%" : number === 10 ? "50%" : null;

        return (
          <li key={number} className="text-center">
            <span
              className={`grid aspect-square place-items-center rounded-full border-2 text-sm font-black ${
                earned
                  ? "border-[#24301f] bg-[#b1c553] text-[#24301f]"
                  : "border-[#8d9574] bg-[#fffaf2] text-[#4c5a2d]"
              }`}
              aria-label={`${number}${earned ? " earned" : " not earned"}${
                reward ? `, ${reward} reward` : ""
              }`}
            >
              {earned ? "✓" : number}
            </span>
            {reward && (
              <span className="mt-1 block text-xs font-extrabold text-[#a44530]">
                {reward}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
