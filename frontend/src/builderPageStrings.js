// Copy for the full-page Package Builder and the "draft ready" card in the chat.

export const PAGE_I18N = {
  en: {
    backChat: "Back to chat", yourPackage: "Your package", tripDetails: "Trip details", choices: "Your choices",
    itinerary: "Day by day", highlights: "Highlights", included: "What's included",
    chatTitle: "Chat with Aura", chatOpen: "Ask Aura", chatPh: "Ask anything or tell Aura what to change…", chatSend: "Send",
    greet: (why) => `Hi! I've drafted this package from our chat. ${why || ""}\n\nChange anything on the page, or just tell me what you'd like different — I'll suggest changes and you decide.`.trim(),
    applied: "Applied ✓", budgetTitle: "Budget", summary: "Summary", perPerson: "Total for",
    readyTitle: "Your draft is ready to build", readyText: "I'll turn what you told me into an editable package with live pricing. Nothing is booked.",
    readyBtn: "Create draft & open Package Builder", openAgain: "Open Package Builder",
    floor: (f, g) => `Lowest with option changes: ${f}${g > 0 ? ` — still ${g} above your budget` : ""}`, shorterTitle: "Shorter-stay route (indicative)", shorterRow: (n, price) => `${n} days ≈ ${price}`, fitsBudget: "fits your budget", whyPrice: "What makes up the price",
    noteDraft: "Draft only — nothing is booked or charged.",
  },
  zh: {
    backChat: "返回聊天", yourPackage: "您的套餐", tripDetails: "行程信息", choices: "您的选择",
    itinerary: "每日行程", highlights: "亮点", included: "包含内容",
    chatTitle: "与 Aura 聊天", chatOpen: "询问 Aura", chatPh: "随时提问，或告诉 Aura 想改什么…", chatSend: "发送",
    greet: (why) => `您好！我根据我们的对话起草了这个套餐。${why || ""}\n\n您可以直接在页面上修改，也可以告诉我想怎么调整——我会提出建议，由您决定。`.trim(),
    applied: "已应用 ✓", budgetTitle: "预算", summary: "摘要", perPerson: "总价（人数：",
    readyTitle: "您的草稿已准备好", readyText: "我会把您告诉我的内容变成可编辑、实时报价的套餐。不会进行任何预订。",
    readyBtn: "生成草稿并打开套餐定制", openAgain: "打开套餐定制",
    floor: (f, g) => `调整选项后的最低价：${f}${g > 0 ? `——仍高出预算 ${g}` : ""}`, shorterTitle: "缩短行程方案（仅供参考）", shorterRow: (n, price) => `${n} 天 ≈ ${price}`, fitsBudget: "符合预算", whyPrice: "价格构成",
    noteDraft: "仅为草稿——不会预订或扣款。",
  },
  es: {
    backChat: "Volver al chat", yourPackage: "Tu paquete", tripDetails: "Detalles del viaje", choices: "Tus elecciones",
    itinerary: "Día a día", highlights: "Destacados", included: "Qué incluye",
    chatTitle: "Chatea con Aura", chatOpen: "Pregunta a Aura", chatPh: "Pregunta lo que quieras o dile a Aura qué cambiar…", chatSend: "Enviar",
    greet: (why) => `¡Hola! He preparado este paquete a partir de nuestra conversación. ${why || ""}\n\nCambia lo que quieras en la página, o dime qué te gustaría distinto: te propongo cambios y tú decides.`.trim(),
    applied: "Aplicado ✓", budgetTitle: "Presupuesto", summary: "Resumen", perPerson: "Total para",
    readyTitle: "Tu borrador está listo para crearse", readyText: "Convertiré lo que me contaste en un paquete editable con precio en vivo. No se reserva nada.",
    readyBtn: "Crear borrador y abrir el creador de paquetes", openAgain: "Abrir el creador de paquetes",
    floor: (f, g) => `Mínimo cambiando opciones: ${f}${g > 0 ? ` — aún ${g} por encima de tu presupuesto` : ""}`, shorterTitle: "Opción de estancia más corta (orientativa)", shorterRow: (n, price) => `${n} días ≈ ${price}`, fitsBudget: "cabe en tu presupuesto", whyPrice: "Qué compone el precio",
    noteDraft: "Solo borrador: no se reserva ni cobra nada.",
  },
  fr: {
    backChat: "Retour au chat", yourPackage: "Votre forfait", tripDetails: "Détails du voyage", choices: "Vos choix",
    itinerary: "Jour par jour", highlights: "Points forts", included: "Ce qui est inclus",
    chatTitle: "Discuter avec Aura", chatOpen: "Demander à Aura", chatPh: "Posez une question ou dites à Aura quoi changer…", chatSend: "Envoyer",
    greet: (why) => `Bonjour ! J'ai préparé ce forfait à partir de notre échange. ${why || ""}\n\nModifiez ce que vous voulez sur la page, ou dites-moi ce que vous aimeriez changer : je propose, vous décidez.`.trim(),
    applied: "Appliqué ✓", budgetTitle: "Budget", summary: "Récapitulatif", perPerson: "Total pour",
    readyTitle: "Votre brouillon est prêt à être créé", readyText: "Je transforme ce que vous m'avez dit en forfait modifiable avec prix en direct. Rien n'est réservé.",
    readyBtn: "Créer le brouillon et ouvrir le créateur de forfait", openAgain: "Ouvrir le créateur de forfait",
    floor: (f, g) => `Minimum en changeant les options : ${f}${g > 0 ? ` — encore ${g} au-dessus de votre budget` : ""}`, shorterTitle: "Séjour plus court (indicatif)", shorterRow: (n, price) => `${n} jours ≈ ${price}`, fitsBudget: "dans votre budget", whyPrice: "Ce qui compose le prix",
    noteDraft: "Brouillon uniquement : rien n'est réservé ni débité.",
  },
  de: {
    backChat: "Zurück zum Chat", yourPackage: "Ihr Paket", tripDetails: "Reisedetails", choices: "Ihre Auswahl",
    itinerary: "Tag für Tag", highlights: "Highlights", included: "Inklusive",
    chatTitle: "Mit Aura chatten", chatOpen: "Aura fragen", chatPh: "Fragen Sie etwas oder sagen Sie Aura, was sich ändern soll…", chatSend: "Senden",
    greet: (why) => `Hallo! Ich habe dieses Paket aus unserem Gespräch entworfen. ${why || ""}\n\nÄndern Sie auf der Seite, was Sie möchten, oder sagen Sie mir, was anders sein soll – ich schlage vor, Sie entscheiden.`.trim(),
    applied: "Übernommen ✓", budgetTitle: "Budget", summary: "Übersicht", perPerson: "Summe für",
    readyTitle: "Ihr Entwurf kann erstellt werden", readyText: "Ich mache aus Ihren Angaben ein bearbeitbares Paket mit Live-Preis. Es wird nichts gebucht.",
    readyBtn: "Entwurf erstellen & Paket-Konfigurator öffnen", openAgain: "Paket-Konfigurator öffnen",
    floor: (f, g) => `Minimum mit anderen Optionen: ${f}${g > 0 ? ` — noch ${g} über Ihrem Budget` : ""}`, shorterTitle: "Kürzerer Aufenthalt (Richtwert)", shorterRow: (n, price) => `${n} Tage ≈ ${price}`, fitsBudget: "im Budget", whyPrice: "Woraus sich der Preis zusammensetzt",
    noteDraft: "Nur ein Entwurf – es wird nichts gebucht oder abgebucht.",
  },
};

PAGE_I18N.ko = {
 backChat:"채팅으로 돌아가기",yourPackage:"내 여행 상품",tripDetails:"여행 정보",choices:"선택 항목",itinerary:"일별 일정",highlights:"주요 볼거리",included:"포함 사항",
 chatTitle:"Aura와 대화",chatOpen:"Aura에게 질문",chatPh:"궁금한 점이나 변경하고 싶은 내용을 알려 주세요…",chatSend:"보내기",
 greet:why=>`대화를 바탕으로 여행 초안을 만들었습니다. ${why || ""}\n\n페이지에서 직접 수정하거나 원하는 변경 사항을 알려 주세요. 제안을 검토한 뒤 적용할 수 있습니다.`,
 applied:"적용됨 ✓",budgetTitle:"예산",summary:"요약",perPerson:"총액 / 인원",
 readyTitle:"여행 초안이 준비되었습니다",readyText:"말씀하신 내용을 수정 가능한 여행 상품으로 만들고 가격을 계산합니다. 아직 예약되지 않습니다.",
 readyBtn:"초안 생성 및 여행 상품 만들기 열기",openAgain:"여행 상품 만들기 열기",
 floor:(f,g)=>`옵션 변경 시 최저가: ${f}${g>0?` — 예산보다 ${g} 초과`:""}`,shorterTitle:"기간 단축 제안 (예상)",shorterRow:(n,price)=>`${n}일 ≈ ${price}`,fitsBudget:"예산 이내",whyPrice:"가격 구성",noteDraft:"초안입니다. 아직 예약되거나 결제되지 않았습니다."
};