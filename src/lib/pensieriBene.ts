/**
 * "Pensieri di Bene" — age-appropriate daily inspirational thoughts
 * organized by school level.
 */

export type SchoolTier = "elementari" | "medie" | "superiori" | "universitario";

interface ThoughtEntry {
  it: string;
  en: string;
}

const pool: Record<SchoolTier, ThoughtEntry[]> = {
  elementari: [
    { it: "Sbagliare vuol dire che stai imparando.", en: "Making mistakes means you're learning." },
    { it: "Ogni giorno a scuola sei un po' più grande di ieri.", en: "Every day at school you grow a little more." },
    { it: "Chiedere aiuto alla maestra è una cosa coraggiosa.", en: "Asking your teacher for help is a brave thing to do." },
    { it: "Anche le cose difficili diventano facili se ci provi ogni giorno.", en: "Even hard things become easy if you try every day." },
    { it: "Essere gentili con i compagni rende la scuola più bella per tutti.", en: "Being kind to classmates makes school better for everyone." },
    { it: "Non importa chi finisce prima. Importa che tu faccia del tuo meglio.", en: "It doesn't matter who finishes first. What matters is that you do your best." },
    { it: "I tuoi sbagli non ti definiscono. Come ti rialzi, sì.", en: "Your mistakes don't define you. How you get back up does." },
    { it: "Se hai 10 caramelle e ne dai 3 a un amico, ne rimangono 7. Condividere non ti fa avere meno — ti fa avere un amico in più.", en: "If you have 10 candies and give 3 to a friend, you have 7 left. Sharing doesn't give you less — it gives you one more friend." },
    { it: "Le parole hanno un peso. Usale con cura.", en: "Words carry weight. Use them with care." },
  ],
  medie: [
    { it: "Non confrontarti con gli altri. Confrontati con chi eri ieri.", en: "Don't compare yourself to others. Compare yourself to who you were yesterday." },
    { it: "La fatica di oggi è la forza di domani.", en: "Today's effort is tomorrow's strength." },
    { it: "Chi ti vuole bene davvero ti accetta anche quando sbagli.", en: "People who truly care about you accept you even when you make mistakes." },
    { it: "Non devi piacere a tutti. Devi essere onesto con te stesso.", en: "You don't have to please everyone. You have to be honest with yourself." },
    { it: "La curiosità è il motore di tutto. Tienila accesa.", en: "Curiosity drives everything. Keep it alive." },
    { it: "Chiedere aiuto non è debolezza — è intelligenza.", en: "Asking for help isn't weakness — it's intelligence." },
    { it: "Le amicizie vere si vedono nei momenti difficili.", en: "True friendships show in difficult times." },
    { it: "Il talento si allena. La gentilezza si sceglie.", en: "Talent is trained. Kindness is chosen." },
    { it: "I problemi di matematica hanno sempre una soluzione. Come molti problemi della vita — basta cercarla con metodo.", en: "Math problems always have a solution. Like many life problems — you just need to look for it methodically." },
    { it: "Roma non fu costruita in un giorno. Nessuna cosa importante lo è.", en: "Rome wasn't built in a day. Nothing important ever is." },
  ],
  superiori: [
    { it: "Non è importante cadere. È importante rialzarsi.", en: "It's not about falling. It's about getting back up." },
    { it: "Le cose difficili diventano più facili — non perché cambiano, ma perché tu cambi.", en: "Hard things become easier — not because they change, but because you do." },
    { it: "Il tuo valore non dipende dai tuoi voti.", en: "Your worth doesn't depend on your grades." },
    { it: "Scegli con cura chi ti sta vicino — le persone che frequenti ti formano.", en: "Choose carefully who you surround yourself with — the people around you shape you." },
    { it: "Non sapere cosa fare della tua vita a 17 anni è normale. Anzi, è onesto.", en: "Not knowing what to do with your life at 17 is normal. In fact, it's honest." },
    { it: "La strada più lunga è spesso quella che porta dove vuoi davvero andare.", en: "The longest road is often the one that takes you where you truly want to go." },
    { it: "Fare la cosa giusta quando è difficile — questo si chiama carattere.", en: "Doing the right thing when it's hard — that's called character." },
    { it: "Un piccolo passo ogni giorno porta lontano — più di mille passi fatti una volta sola.", en: "A small step every day takes you far — more than a thousand steps taken all at once." },
    { it: "Sbagliare fa parte dell'imparare. Chi non sbaglia non sta provando abbastanza.", en: "Making mistakes is part of learning. If you're not making mistakes, you're not trying hard enough." },
    { it: "L'acqua scava la roccia non per forza, ma per costanza. Così funziona anche lo studio.", en: "Water carves rock not by force, but by persistence. Study works the same way." },
    { it: "Socrate diceva di sapere di non sapere. Era il più saggio della città.", en: "Socrates said he knew that he knew nothing. He was the wisest man in the city." },
  ],
  universitario: [
    { it: "La vera intelligenza è sapere quello che non sai.", en: "True intelligence is knowing what you don't know." },
    { it: "Studia qualcosa che ti interessa davvero — o trova l'interesse in quello che studi.", en: "Study something that truly interests you — or find interest in what you study." },
    { it: "Il successo misura i risultati. Il carattere misura come li hai ottenuti.", en: "Success measures results. Character measures how you achieved them." },
    { it: "Non tutti i tuoi colleghi diventeranno amici. Va bene così.", en: "Not all your classmates will become friends. That's okay." },
    { it: "Chi sei fuori dall'università conta quanto chi sei dentro.", en: "Who you are outside the university matters as much as who you are inside." },
    { it: "La conoscenza senza saggezza è potere senza direzione.", en: "Knowledge without wisdom is power without direction." },
    { it: "Le decisioni più importanti della tua vita non le prende nessun professore al posto tuo.", en: "The most important decisions in your life won't be made by any professor for you." },
    { it: "Impara a stare con il disagio — è lì che avviene la crescita vera.", en: "Learn to sit with discomfort — that's where real growth happens." },
    { it: "Il tempo che dedichi a capire chi sei non è tempo perso — è il più importante.", en: "The time you spend understanding who you are isn't wasted — it's the most important." },
    { it: "Tratta ogni persona che incontri come se avesse qualcosa da insegnarti. Di solito ce l'ha.", en: "Treat every person you meet as if they have something to teach you. Usually, they do." },
    { it: "Il mercato misura il prezzo di tutto e il valore di niente. Oscar Wilde lo disse prima di Keynes.", en: "The market measures the price of everything and the value of nothing. Oscar Wilde said it before Keynes." },
    { it: "La giustizia e la legge non sono sempre la stessa cosa. Il tuo lavoro sarà capire la differenza.", en: "Justice and law aren't always the same thing. Your job will be to understand the difference." },
    { it: "Il paziente non è una diagnosi. È una persona con una diagnosi.", en: "The patient is not a diagnosis. They are a person with a diagnosis." },
  ],
};

/**
 * Map profile school_level value to a tier. Falls back to "superiori".
 */
export function getTier(schoolLevel: string | null | undefined): SchoolTier {
  if (!schoolLevel) return "superiori";
  if (schoolLevel === "alunno" || schoolLevel === "elementari") return "elementari";
  if (schoolLevel === "medie" || schoolLevel.startsWith("media-")) return "medie";
  if (schoolLevel === "superiori") return "superiori";
  if (schoolLevel === "universitario") return "universitario";
  return "superiori";
}

/**
 * Return a deterministic daily thought based on the date so the same thought
 * is shown throughout the day but changes the next day.
 */
export function getDailyThought(schoolLevel: string | null | undefined, lang: string = "it"): string {
  const tier = getTier(schoolLevel);
  const thoughts = pool[tier];
  // Simple day-of-year hash for deterministic daily rotation
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const index = dayOfYear % thoughts.length;
  return lang.startsWith("it") ? thoughts[index].it : thoughts[index].en;
}
