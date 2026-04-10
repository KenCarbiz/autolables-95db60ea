import { useDealerSettings } from "@/contexts/DealerSettingsContext";

interface AddendumHeaderProps {
  inkSaving?: boolean;
}

const AddendumHeader = ({ inkSaving }: AddendumHeaderProps) => {
  const { settings } = useDealerSettings();

  return (
    <div className={`text-center py-3 border-b-2 border-navy ${inkSaving ? "bg-card" : "bg-navy text-primary-foreground"}`}>
      {settings.dealer_logo_url && settings.feature_custom_branding && (
        <img
          src={settings.dealer_logo_url}
          alt={settings.dealer_name}
          className="h-8 mx-auto mb-1 object-contain"
        />
      )}
      <h1 className="text-lg font-extrabold tracking-wide font-barlow-condensed uppercase">Dealer Addendum</h1>
      <p className="text-[9px] tracking-widest mt-0.5 opacity-80">Supplemental Window Label · Dealer-Installed Products &amp; Accessories</p>
      <p className="text-[10px] font-semibold mt-1">{settings.dealer_name}</p>
      <p className="text-[8px] opacity-70">{settings.dealer_tagline}</p>
    </div>
  );
};

export default AddendumHeader;
