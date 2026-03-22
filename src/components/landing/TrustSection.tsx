import { Shield, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useLang } from "@/contexts/LangContext";
import type { TranslationKey } from "@/lib/i18n";

interface TrustSectionProps {
  extraLine?: string;
}

export function TrustSection({ extraLine }: TrustSectionProps) {
  const { t } = useLang();

  const trustKeys: TranslationKey[] = [
    "trust_1",
    "trust_2",
    "trust_3",
    "trust_4",
    "trust_5",
    "trust_6",
  ];

  return (
    <section className="py-16 px-6" style={{ backgroundColor: "#F8FAFC" }}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3 }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#0F172A" }}>
            {t("trust_title")}
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trustKeys.map((key, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              className="flex items-start gap-3 p-4"
            >
              <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#0070C0" }} />
              <span className="text-sm" style={{ color: "#475569" }}>
                {t(key)}
              </span>
            </motion.div>
          ))}
          {extraLine && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.2 }}
              className="flex items-start gap-3 p-4"
            >
              <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#0070C0" }} />
              <span className="text-sm" style={{ color: "#475569" }}>
                {extraLine}
              </span>
            </motion.div>
          )}
        </div>

        <div className="text-center mt-8">
          <Link
            to="/security"
            className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
            style={{ color: "#0070C0" }}
          >
            {t("trust_link")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
