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
      transition={{ duration: 0.5 }}
      className={`mx-auto w-full ${className}`}
      style={{ maxWidth: 520 }}
    >
      {/* Laptop body */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #3A3A3A, #1A1A1A)",
          padding: "8px 8px 6px",
          boxShadow: "0 30px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        {/* Camera dot */}
        <div className="flex justify-center mb-[6px]">
          <div className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: "#555" }} />
        </div>

        {/* Screen bezel */}
        <div
          className="rounded-[4px] overflow-hidden"
          style={{ border: "1px solid rgba(0,0,0,0.3)" }}
        >
          {/* Content */}
          <div className="bg-white p-5 text-left" style={{ minHeight: 280 }}>
            {children}
          </div>
        </div>
      </div>

      {/* Laptop base */}
      <div
        className="mx-auto relative"
        style={{
          width: "110%",
          maxWidth: "110%",
          marginLeft: "-5%",
          height: 14,
          background: "linear-gradient(180deg, #3A3A3A, #2A2A2A)",
          borderRadius: "0 0 8px 8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        {/* Hinge notch */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2"
          style={{
            width: 60,
            height: 4,
            backgroundColor: "#555",
            borderRadius: "0 0 4px 4px",
          }}
        />
      </div>
    </motion.div>
  );
}
