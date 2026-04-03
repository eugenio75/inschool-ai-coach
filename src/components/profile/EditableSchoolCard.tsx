import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { School, MapPin, Pencil, Check, X } from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { CityAutocomplete } from "@/components/shared/CityAutocomplete";
import { SchoolAutocomplete } from "@/components/shared/SchoolAutocomplete";
import { normalizeClass } from "@/lib/normalizeClass";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface SchoolData {
  city: string;
  schoolName: string;
  schoolCode: string | null;
  classSection: string;
}

interface EditableSchoolCardProps {
  data: SchoolData;
  onChange: (data: SchoolData) => void;
  delay?: number;
}

type EditingField = "city" | "school" | "class" | null;

export function EditableSchoolCard({ data, onChange, delay = 0.15 }: EditableSchoolCardProps) {
  const { t } = useLang();
  const [editing, setEditing] = useState<EditingField>(null);
  const [tempCity, setTempCity] = useState(data.city);
  const [tempSchoolName, setTempSchoolName] = useState(data.schoolName);
  const [tempSchoolCode, setTempSchoolCode] = useState<string | null>(data.schoolCode);
  const [tempClass, setTempClass] = useState(data.classSection);

  useEffect(() => {
    setTempCity(data.city);
    setTempSchoolName(data.schoolName);
    setTempSchoolCode(data.schoolCode);
    setTempClass(data.classSection);
  }, [data]);

  const isEmpty = !data.city && !data.schoolName && !data.classSection;

  const startEdit = (field: EditingField) => {
    setTempCity(data.city);
    setTempSchoolName(data.schoolName);
    setTempSchoolCode(data.schoolCode);
    setTempClass(data.classSection);
    setEditing(field);
  };

  const cancelEdit = () => setEditing(null);

  const confirmEdit = () => {
    onChange({
      city: tempCity,
      schoolName: tempSchoolName,
      schoolCode: tempSchoolCode,
      classSection: tempClass,
    });
    setEditing(null);
  };

  const handleSchoolChange = (name: string, code: string | null, city: string) => {
    setTempSchoolName(name);
    setTempSchoolCode(code);
    if (city) setTempCity(city);
  };

  const renderValue = (value: string, placeholder: string) => (
    <span className={value ? "text-foreground text-sm" : "text-muted-foreground text-sm italic"}>
      {value || placeholder}
    </span>
  );

  const renderEditButton = (field: EditingField) => (
    <button
      onClick={() => startEdit(field)}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
  );

  const renderConfirmCancel = () => (
    <div className="flex gap-1 shrink-0">
      <button onClick={confirmEdit} className="w-7 h-7 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 transition-colors">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={cancelEdit} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay }}
      className="bg-card rounded-2xl border border-border p-5 shadow-soft"
    >
      <div className="flex items-center gap-2 mb-1">
        <School className="w-4 h-4 text-accent-foreground" />
        <h3 className="font-display font-semibold text-foreground text-sm">
          {t("profile_school_title")}
        </h3>
      </div>

      {isEmpty && !editing && (
        <p className="text-xs text-muted-foreground mb-4">{t("profile_school_empty_prompt")}</p>
      )}
      {!isEmpty && !editing && (
        <p className="text-xs text-muted-foreground mb-4">{t("profile_school_subtitle")}</p>
      )}

      <div className="space-y-3">
        {/* City */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {t("profile_school_city_label")}
          </label>
          {editing === "city" ? (
            <div className="space-y-2">
              <CityAutocomplete
                value={tempCity}
                onChange={setTempCity}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {renderConfirmCancel()}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1">{renderValue(data.city, t("profile_school_city_placeholder"))}</div>
              {renderEditButton("city")}
            </div>
          )}
        </div>

        {/* School */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {t("profile_school_name_label")}
          </label>
          {editing === "school" ? (
            <div className="space-y-2">
              <SchoolAutocomplete
                value={tempSchoolName}
                onChange={handleSchoolChange}
                cityFilter={tempCity || undefined}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {renderConfirmCancel()}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1">{renderValue(data.schoolName, t("profile_school_name_placeholder"))}</div>
              {renderEditButton("school")}
            </div>
          )}
        </div>

        {/* Class */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {t("profile_school_class_label")}
          </label>
          {editing === "class" ? (
            <div className="space-y-2">
              <input
                type="text"
                value={tempClass}
                onChange={(e) => setTempClass(e.target.value.slice(0, 20))}
                placeholder={t("profile_school_class_placeholder")}
                maxLength={20}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {renderConfirmCancel()}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1">{renderValue(data.classSection, t("profile_school_class_placeholder"))}</div>
              {renderEditButton("class")}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
