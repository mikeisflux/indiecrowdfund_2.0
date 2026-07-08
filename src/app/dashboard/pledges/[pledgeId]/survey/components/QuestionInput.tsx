"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

// Address/Email toggle component - needs its own component to use hooks
function AddressEmailToggle({
  questionId,
  displayType,
  value,
  onChange,
}: {
  questionId?: string;
  displayType: string;
  value?: string;
  onChange: (value: string | string[]) => void;
}) {
  const strValue = value || "";
  const [wantsNew, setWantsNew] = useState(
    strValue !== "" && strValue !== "No change needed"
  );
  const placeholderText =
    displayType === "address"
      ? "Enter your new address..."
      : "Enter your new email...";
  const noId = `${questionId || displayType}-no`;
  const yesId = `${questionId || displayType}-yes`;

  // Ensure value is set to "No change needed" if it's currently empty
  // (handles initial render where radio shows "No" but value was never written)
  useEffect(() => {
    if (!value && !wantsNew) {
      onChange("No change needed");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <RadioGroup
        value={wantsNew ? "yes" : "no"}
        onValueChange={(v) => {
          if (v === "no") {
            setWantsNew(false);
            onChange("No change needed");
          } else {
            setWantsNew(true);
            onChange("");
          }
        }}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="no" id={noId} />
          <Label htmlFor={noId}>No, keep my current {displayType}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="yes" id={yesId} />
          <Label htmlFor={yesId}>Yes, I have a new {displayType}</Label>
        </div>
      </RadioGroup>
      {wantsNew &&
        (displayType === "email" ? (
          <Input
            type="email"
            value={strValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholderText}
          />
        ) : (
          <Textarea
            value={strValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholderText}
          />
        ))}
    </div>
  );
}

// Question Input Component
export function QuestionInput({
  questionId,
  type,
  displayType,
  options,
  value,
  onChange,
}: {
  questionId?: string;
  type: string;
  displayType?: string | null;
  options: string[];
  value?: string | string[];
  onChange: (value: string | string[]) => void;
}) {
  // Address and email types get their own component with local state
  if (displayType === "address" || displayType === "email") {
    return (
      <AddressEmailToggle
        questionId={questionId}
        displayType={displayType}
        value={value as string | undefined}
        onChange={onChange}
      />
    );
  }

  if (type === "OPEN_TEXT") {
    return (
      <Textarea
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your answer..."
      />
    );
  }

  if (type === "SINGLE_SELECT") {
    return (
      <RadioGroup
        value={(value as string) || ""}
        onValueChange={onChange}
      >
        {options.map((opt) => (
          <div key={opt} className="flex items-center space-x-2">
            <RadioGroupItem value={opt} id={opt} />
            <Label htmlFor={opt}>{opt}</Label>
          </div>
        ))}
      </RadioGroup>
    );
  }

  if (type === "MULTIPLE_SELECT") {
    const selected = (value as string[]) || [];
    return (
      <div className="space-y-2">
        {options.map((opt) => (
          <div key={opt} className="flex items-center space-x-2">
            <Checkbox
              id={opt}
              checked={selected.includes(opt)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange([...selected, opt]);
                } else {
                  onChange(selected.filter((s) => s !== opt));
                }
              }}
            />
            <Label htmlFor={opt}>{opt}</Label>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
