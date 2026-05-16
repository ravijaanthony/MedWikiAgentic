import { GENDER_OPTIONS } from "./constants";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function GenderSelector({ value, onChange }: Props) {
  return (
    <fieldset>
      <legend className="block text-sm font-semibold text-slate-700">Gender</legend>
      <div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Gender">
        {GENDER_OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`option-card min-h-[56px] text-base font-semibold text-slate-800 ${
                selected ? "option-card-selected" : ""
              }`}
            >
              <input
                type="radio"
                name="gender"
                value={opt.value}
                className="sr-only"
                checked={selected}
                onChange={() => onChange(opt.value)}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
