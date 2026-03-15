import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Heart, Brain, Shield, Sparkles, ArrowRight, BookOpen, Clock, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const features = [
  {
    icon: Heart,
    title: "Supporto emotivo",
    description: "Un coach paziente che capisce frustrazioni e blocchi, mai giudicante.",
  },
  {
    icon: Brain,
    title: "Ragionamento guidato",
    description: "Non dà risposte. Guida il pensiero con domande e micro-passi.",
  },
  {
    icon: Clock,
    title: "Sessioni di focus",
    description: "Timer adattivi all'età, rituali di inizio, recap motivanti.",
  },
  {
    icon: TrendingUp,
    title: "Crescita visibile",
    description: "Progressi gentili senza competizione. Autonomia, costanza, coraggio.",
  },
];

const howItWorks = [
  { step: "1", title: "Aggiungi i compiti", description: "Scrivi, fotografa il diario o il libro di testo." },
  { step: "2", title: "Scegli da dove partire", description: "L'AI suggerisce il compito migliore per iniziare." },
  { step: "3", title: "Studia con il coach", description: "Domande guidate, micro-passi, niente risposte dirette." },
  { step: "4", title: "Vedi i progressi", description: "Tu e i tuoi genitori vedete la crescita nel tempo." },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-semibold text-foreground">Inschool</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => navigate("/auth")}
            >
              Accedi
            </Button>
            <Button
              onClick={() => navigate("/auth")}
              className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl px-5"
            >
              Inizia gratis
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sage-light text-sage-dark text-sm font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Il coach AI per i compiti
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
            className="font-display text-5xl md:text-6xl font-bold text-foreground leading-[1.1] mb-6"
          >
            I compiti senza
            <br />
            <span className="text-primary">il mal di testa.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.3 }}
            className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Inschool è il coach AI che aiuta bambini e ragazzi a studiare con più
            fiducia, concentrazione e autonomia. Non fa i compiti per loro — li
            aiuta a pensare.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              onClick={() => navigate("/onboarding")}
              className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl px-8 py-6 text-base font-medium shadow-card"
            >
              Inizia con il tuo bambino
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/parent-dashboard")}
              className="rounded-2xl px-8 py-6 text-base border-border text-muted-foreground hover:bg-muted"
            >
              Scopri l'area genitori
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-surface-muted">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">
              Un approccio diverso ai compiti
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Non un tutor che spiega. Non un'app che risolve. Un coach che guida il ragionamento.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ ...spring, delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className="p-6 rounded-2xl bg-card shadow-soft border border-border"
              >
                <div className="w-10 h-10 rounded-xl bg-sage-light flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-sage-dark" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">
              Come funziona
            </h2>
            <p className="text-muted-foreground">Quattro passi verso lo studio autonomo.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ ...spring, delay: i * 0.15 }}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-clay-light text-clay-dark font-display font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Coach preview */}
      <section className="py-20 px-6 bg-surface-muted">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">
              Il coach che ogni bambino meriterebbe
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Paziente come un fratello maggiore. Attento come uno scienziato.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={spring}
            className="bg-card rounded-2xl shadow-card border border-border p-8"
          >
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-sage-light flex-shrink-0 flex items-center justify-center mt-0.5">
                  <Shield className="w-4 h-4 text-sage-dark" />
                </div>
                <div className="bg-sage-light/50 rounded-2xl rounded-tl-md px-4 py-3 max-w-md">
                  <p className="text-sm text-foreground leading-relaxed">
                    Vedo che hai una divisione con le frazioni. Prima di risolverla,
                    secondo te cosa ci dice quel numero sopra la riga?
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <div className="bg-muted rounded-2xl rounded-tr-md px-4 py-3 max-w-md">
                  <p className="text-sm text-foreground leading-relaxed">
                    Ehm... quante parti abbiamo?
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-sage-light flex-shrink-0 flex items-center justify-center mt-0.5">
                  <Shield className="w-4 h-4 text-sage-dark" />
                </div>
                <div className="bg-sage-light/50 rounded-2xl rounded-tl-md px-4 py-3 max-w-md">
                  <p className="text-sm text-foreground leading-relaxed">
                    Esatto! Hai trovato la logica da solo. 🌱 Quante parti
                    abbiamo preso? Prova a dirlo con parole tue.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-2">
              <button className="px-4 py-2 rounded-xl bg-sage-light text-sage-dark text-sm font-medium hover:bg-accent transition-colors">
                Sono bloccato
              </button>
              <button className="px-4 py-2 rounded-xl bg-clay-light text-clay-dark text-sm font-medium hover:bg-accent transition-colors">
                Dammi un indizio
              </button>
              <button className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-medium hover:bg-accent transition-colors">
                Credo di aver capito
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={spring}
          >
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">
              Pronto a cambiare il momento dei compiti?
            </h2>
            <p className="text-muted-foreground mb-8">
              Bastano 2 minuti per iniziare. Nessuna carta di credito richiesta.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/onboarding")}
              className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl px-8 py-6 text-base font-medium shadow-card"
            >
              Inizia gratis
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-display text-sm font-semibold text-foreground">Inschool</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 Inschool. I compiti senza il mal di testa.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
