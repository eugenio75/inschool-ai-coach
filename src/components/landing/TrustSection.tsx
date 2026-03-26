import { Shield, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useLang } from "@/contexts/LangContext";
import type { TranslationKey } from "@/lib/i18n";

const trustItems: { title: TranslationKey; desc: TranslationKey }[] = [
  { title: "trust_1", desc: "trust_1_desc" },
  { title: "trust_2", desc: "trust_2_desc" },
  { title: "trust_3", desc: "trust_3_desc" },
  { title: "trust_6", desc: "trust_6_desc" },
  { title: "trust_7", desc: "trust_7_desc" },
  { title: "trust_4", desc: "trust_4_desc" },
  { title: "trust_5", desc: "trust_5_desc" },
];

export function TrustSection() {
  const { t } = useLang();

  return (
    <section className="py-16 px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3 }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A3A5C" }}>
            {t("trust_title")}
          </h2>
        </motion.div>

        <div className="space-y-4 max-w-2xl mx-auto">
          {trustItems.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              className="flex items-start gap-4"
            >
              <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#0070C0" }} />
              <div>
                <p className="font-semibold text-sm" style={{ color: "#1A3A5C" }}>
                  {t(item.title)}
                </p>
                <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
                  {t(item.desc)}
                </p>
              </div>
            </motion.div>
          ))}
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
