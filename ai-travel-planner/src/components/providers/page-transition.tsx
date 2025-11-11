"use client";
import { PropsWithChildren } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export function PageTransition({ children }: PropsWithChildren) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{ minHeight: "60vh" }}
    >
      {children}
    </motion.div>
  );
}
