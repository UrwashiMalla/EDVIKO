/**
 * academicGuardrail.js
 * Enforces strict study-only guardrails for EDVIKO AI Chatbot and Tutor.
 * Ensures the AI exclusively answers academic/study-related queries and
 * firmly refuses all non-academic, casual, entertainment, and bypass queries.
 */

// Jailbreak / Prompt override attempts to bypass academic guardrail
const JAILBREAK_PATTERNS = [
  /\b(ignore (all )?(previous|prior|above) instructions)\b/i,
  /\b(pretend (to be|you are|you're))\b/i,
  /\b(roleplay as|act as a (hacker|gamer|friend|comedian|unfiltered))\b/i,
  /\b(dan mode|jailbreak|developer mode|unrestricted mode)\b/i,
  /\b(bypass (restrictions|guardrails|filters|rules))\b/i,
];

// Patterns indicating clearly non-study / casual / entertainment queries
const NON_STUDY_PATTERNS = [
  // Sports & athletes
  /\b(cricket|ipl|football|soccer|fifa|messi|ronaldo|virat kohli|rohit sharma|dhoni|neeraj chopra|sachin|world cup|champions league|premier league|kabaddi|badminton|tennis|nba|f1|formula 1|wimbledon|olympics|sports betting|fantasy team|dream11|match prediction|who won the match)\b/i,

  // Gaming & video games
  /\b(gta|fortnite|pubg|freefire|free fire|minecraft|roblox|valorant|call of duty|cod mobile|playstation|ps5|xbox|nintendo|cheat code|gameplay|battle royale|aimbot|headshot|gamer)\b/i,
  /\b(play (a )?game|let'?s play|truth or dare|rock paper scissors|tic tac toe|guess the number)\b/i,

  // Movies, web series, pop-culture & celebrity gossip
  /\b(movie|film|cinema|actor|actress|bollywood|hollywood|netflix|prime video|hotstar|web series|tv show|box office|trailer|teaser)\b/i,
  /\b(shah rukh khan|srk|salman khan|aamir khan|deepika|alia bhatt|ranbir|tom cruise|taylor swift|bts|justin bieber|k-pop|drake|eminem|ariana grande)\b/i,
  /\b(anime|manga|naruto|one piece|dragon ball|jujutsu kaisen|demon slayer|attack on titan|marvel|mcu|avengers|iron man|batman|superman|spider-?man)\b/i,
  /\b(recommend (me )?(a |some )?(movie|song|series|show)|what should i watch)\b/i,

  // Music, rap, entertainment & humor
  /\b(joke|funny story|roast me|comedy roast|flirt|pickup line|funny meme|make me laugh|chutkula|shayari|love shayari)\b/i,
  /\b(write (a )?song|write (a )?rap|compose (a )?lyrics|sing (a )?song|gana gao)\b/i,

  // Romantic, dating & personal relationships
  /\b(dating|crush|girlfriend|boyfriend|love me|i love you|marry me|romantic|breakup|propose|pyaar|mohabbat|ishq|shadi)\b/i,
  /\b(do you have feelings|are you single|who is your crush)\b/i,

  // Horoscopes & occult
  /\b(horoscope|astrology|zodiac|rashifal|kundali|tarot|future prediction|fortune teller)\b/i,

  // Cooking, recipes, food & lifestyle
  /\b(recipe|how to cook|how to make biryani|make pizza|make burger|make tea|chai kaise banaye|food review|diet plan for weight loss)\b/i,
  /\b(outfit|what to wear|party venue|nightclub|bar recommendation|buy clothes|fashion advice|skincare routine|haircut style|makeup tip)\b/i,

  // Travel, tourism & hotels
  /\b(hotel booking|flight ticket|best places to visit|tourist spots|vacation in|trip to goa|trip to manali)\b/i,

  // Casual chit-chat & boredom
  /\b(bore ho raha|bore lag raha|i'?m bored|boring day|entertain me|kuch maza|time ?pass|chalo baatein karte|let'?s chat|kya haal chaal|aur batao|aur sunao|kya chal raha|kya kar rahe ho|what are you doing)\b/i,
  /\b(kya khaya|what did you eat|breakfast|lunch|dinner|good night sleep well|sweet dreams)\b/i,

  // Quick wealth & speculative finance
  /\b(lottery|get rich quick|crypto buy signal|stock market tip today|dream11 prediction|gambling|satta|betting)\b/i,
];

// Academic keywords that indicate legitimate study context
const ACADEMIC_PATTERNS = [
  /\b(study|learn|explain|definition|formula|theorem|algorithm|code|programming|syntax|math|physics|chemistry|biology|history|geography|economics|science|computer|database|sql|ai|ml|exam|test|quiz|notes|chapter|syllabus|assignment|homework|proof|derivation|analysis|summary|grammar|essay|solve|calculate|matrix|calculus|probability|differential|integral|statistics|algebra|geometry|organic chemistry|thermodynamics|newton|einstein|osmosis|photosynthesis|mitosis|meiosis|dna|rna|microbiology|genetics|macroeconomics|microeconomics|accounting|finance|data structure|recursion|sorting|binary search|graph|tree|dynamic programming|complexity|big o|linear regression|logistic regression|neural network|transformer|deep learning|operating system|process|thread|deadlock|cache|memory|boolean|logic gate|discrete math)\b/i,
  /\b(kyu|kaise|kya hai|samjhao|arth|spasht kara|mahiti|sutra|udaharan|shikva|ganit|vigyan|padhai|pariksha|adhayan|prashna|uttar)\b/i,
];

export const getAcademicRefusalMessage = (lang = "English") => {
  switch (lang) {
    case "Hindi":
      return "मैं EDVIKO का शैक्षणिक AI ट्यूटर हूँ और मैं केवल आपकी पढ़ाई, पाठ्यक्रम और अकादमिक विषयों (गणित, विज्ञान, कंप्यूटर, इतिहास आदि) में सहायता करने के लिए अधिकृत हूँ। मैं गैर-शैक्षणिक, मनोरंजन या अन्य अनौपचारिक विषयों पर चर्चा नहीं कर सकता।\n\nकृपया अपने विषय, होमवर्क, फॉर्मूला या परीक्षा की तैयारी से संबंधित कोई भी प्रश्न पूछें, मुझे आपकी मदद करने में खुशी होगी!";
    case "Marathi":
      return "मी EDVIKO चा शैक्षणिक AI ट्यूटर आहे आणि मी केवळ आपल्या अभ्यासात, शैक्षणिक विषयांत व परीक्षा तयारीमध्ये मदत करण्यासाठी अधिकृत आहे. मी इतर अ-शैक्षणिक, मनोरंजन किंवा अनौपचारिक विषयांवर चर्चा करू शकत नाही.\n\nकृपया आपल्या विषयाशी, सूत्रांशी, गृहपाठाशी किंवा अभ्यासाशी संबंधित प्रश्न विचारा!";
    case "Hinglish":
      return "Main EDVIKO ka Academic AI Tutor hoon aur main sirf aapki studies, course concepts aur academic learning (Maths, Science, Coding, Exam prep) mein help kar sakta hoon. Main non-study baatein, casual chit-chat ya entertainment entertain nahi karta.\n\nKripya apne syllabus, subject doubts, homework ya exam preparation se related sawal puchiye!";
    default:
      return "I am an educational AI tutor at EDVIKO, dedicated strictly to your studies and academic learning. I am not permitted to discuss non-academic topics, casual chit-chat, entertainment, or off-topic subjects.\n\nPlease ask a question related to your subjects, coursework, formulas, problem doubts, or exam preparation, and I will be glad to assist you!";
  }
};

/**
 * Checks if a user prompt is strictly non-study
 */
export const isNonStudyQuery = (text) => {
  if (!text || typeof text !== "string") return false;
  const clean = text.trim().toLowerCase();

  // 1. Check for prompt injection / jailbreak attempts to bypass study restriction
  for (const jb of JAILBREAK_PATTERNS) {
    if (jb.test(clean)) {
      return true;
    }
  }

  // 2. Simple greetings are allowed (the AI greets back and prompts for study topics)
  if (/^(hi|hello|hey|namaste|good morning|good afternoon|good evening|pranam|namaskar|kasa ahes|kaise ho)[!.]*$/i.test(clean)) {
    return false;
  }

  // 3. Check if matches non-study patterns
  for (const pattern of NON_STUDY_PATTERNS) {
    if (pattern.test(clean)) {
      // If it also contains strong academic keywords (e.g. "analyze the economic impact of FIFA"), allow it
      if (ACADEMIC_PATTERNS.some((p) => p.test(clean))) {
        return false;
      }
      return true;
    }
  }

  return false;
};
