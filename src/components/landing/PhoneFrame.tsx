import { motion } from "framer-motion";

interface PhoneFrameProps {
  children: React.ReactNode;
  className?: string;
}

export function PhoneFrame({ children, className = "" }: PhoneFrameProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`mx-auto ${className}`}
      style={{ maxWidth: 280 }}
    >
      <div
        className="relative rounded-[2.8rem] p-[6px]"
        style={{
          background: "linear-gradient(145deg, #2A2A2A, #0A0A0A)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05) inset",
        }}
      >
        {/* Dynamic Island */}
        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 z-10">
          <div
            className="w-[90px] h-[26px] rounded-full"
            style={{ backgroundColor: "#000" }}
          />
        </div>

        {/* Screen */}
        <div
          className="rounded-[2.4rem] overflow-hidden bg-white relative"
          style={{ border: "1px solid rgba(0,0,0,0.1)" }}
        >
          <div className="pt-10 pb-4 px-4 text-left" style={{ minHeight: 420 }}>
            {children}
          </div>
        </div>

        {/* Home indicator */}
        <div className="flex justify-center mt-[6px] mb-[2px]">
          <div
            className="w-[100px] h-[4px] rounded-full"
            style={{ backgroundColor: "#555" }}
          />
        </div>
      </div>
    </motion.div>
  );
}
