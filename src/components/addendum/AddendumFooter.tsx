import { useDealerSettings } from "@/contexts/DealerSettingsContext";

interface AddendumFooterProps {
  inkSaving?: boolean;
}

const AddendumFooter = ({ inkSaving }: AddendumFooterProps) => {
  const { settings } = useDealerSettings();

  return (
    <div className={`text-center py-2 border-t border-border-custom text-[7px] text-muted-foreground ${inkSaving ? "" : "bg-light"}`}>
      <p>This label must remain affixed to the vehicle until delivery to the purchaser · Retain signed copy for dealership records per applicable state law</p>
      <p className="font-semibold mt-0.5">{settings.dealer_name} · Dealer Addendum · Form HAG-ADD-2026</p>
    </div>
  );
};

export default AddendumFooter;
