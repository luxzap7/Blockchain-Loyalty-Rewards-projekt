import { useState } from "react";
import type { Account } from "../api";
import { shortAddress } from "../format";

interface Props {
  value: string;
  onChange: (address: string) => void;
  accounts: Account[];
  exclude?: string | null; // e.g. the own address when sending tokens
}

/** Pick a known account from a list, or type any other address. */
export default function AddressInput({ value, onChange, accounts, exclude }: Props) {
  const [custom, setCustom] = useState(false);
  const options = accounts.filter((a) => a.address.toLowerCase() !== exclude?.toLowerCase());

  function onSelect(selected: string) {
    setCustom(selected === "custom");
    onChange(selected === "custom" ? "" : selected);
  }

  return (
    <div className="address-input">
      <select value={custom ? "custom" : value} onChange={(e) => onSelect(e.target.value)}>
        <option value="">Choose an account...</option>
        {options.map((a) => (
          <option key={a.address} value={a.address}>
            {a.name ?? "Account"} ({shortAddress(a.address)})
          </option>
        ))}
        <option value="custom">Other address...</option>
      </select>
      {custom && <input placeholder="0x..." value={value} onChange={(e) => onChange(e.target.value.trim())} />}
    </div>
  );
}
