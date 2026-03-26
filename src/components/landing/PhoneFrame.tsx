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
      transition={{ duration: 0.4 }}
      className={`mx-auto ${className}`}
      style={{ maxWidth: 320 }}
    >
      <div
        className="rounded-[2.5rem] p-3 shadow-xl"
        style={{ backgroundColor: "#1A1A1A" }}
      >
        {/* Notch */}
        <div className="flex justify-center mb-2">
          <div
            className="w-24 h-5 rounded-full"
            style={{ backgroundColor: "#0D0D0D" }}
          />
        </div>
        {/* Screen */}
        <div className="rounded-[2rem] overflow-hidden bg-white">
          <div className="p-4 text-left" style={{ minHeight: 380 }}>
            {children}
          </div>
        </div>
        {/* Home indicator */}
        <div className="flex justify-center mt-2">
          <div
            className="w-28 h-1 rounded-full"
            style={{ backgroundColor: "#444" }}
          />
        </div>
      </div>
    </motion.div>
  );
}
