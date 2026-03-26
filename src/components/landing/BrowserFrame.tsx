import { motion } from "framer-motion";

interface BrowserFrameProps {
  children: React.ReactNode;
  className?: string;
}

export function BrowserFrame({ children, className = "" }: BrowserFrameProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className={`mx-auto w-full ${className}`}
      style={{ maxWidth: 680 }}
    >
      <div className="rounded-xl overflow-hidden shadow-xl border border-slate-200">
        {/* Browser bar */}
        <div
          className="flex items-center gap-2 px-4 py-2.5"
          style={{ backgroundColor: "#F1F5F9" }}
        >
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#FD5F57" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#FDBB2E" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#27C83F" }} />
          </div>
          <div
            className="flex-1 rounded-md px-3 py-1 text-xs font-mono ml-3"
            style={{ backgroundColor: "#E2E8F0", color: "#94A3B8" }}
          >
            app.inschool.ai
          </div>
        </div>
        {/* Content */}
        <div className="bg-white p-6 text-left">
          {children}
        </div>
      </div>
    </motion.div>
  );
}
