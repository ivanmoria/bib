// Shared role data, colors, and i18n strings for all pages.

export const ROLES = ['Dependent', 'Follower', 'Partner', 'Leader', 'Resister'];
export const ROLES_PT = ['Dependente', 'Seguidor', 'Parceiro', 'Líder', 'Resistente'];

// Role accent colors used in control.html / monitor.html participant cards
export const ROLE_COLORS = ['#818cf8', '#6ee7b7', '#fbbf24', '#f87171', '#a78bfa'];

// Full-panel background colors for tela.html projection screens (vivid, solid)
export const PANEL_COLORS = ['#5b21b6', '#0f766e', '#b45309', '#1d4ed8', '#9f1239'];

// Card colors for the tela.html welcome panel info cards
export const CARD_COLORS = {
  Dependent: '#8B008B',
  Follower:  '#FFD700',
  Partner:   '#32CD32',
  Leader:    '#1E90FF',
  Resister:  '#FF6B35',
};

export const I18N = {
  pt: {
    title:    'Perfil de Autonomia — Improvisation Assessment Profiles (IAPs)',
    subtitle: 'Improvisação em Musicoterapia I · UFMG · Ferramenta desenvolvida por Ivan Moriá Borges · 2026',
    intro:    'Olá! Esta ferramenta foi desenvolvida pelo professor e musicoterapeuta Ivan Moriá para as aulas de Improvisação em Musicoterapia I · UFMG. Clique em cada card para explorar referências bibliográficas sobre os perfis improvisacionais descritos por Kenneth Bruscia.',
    cardNote: 'NÍVEIS DE INTERAÇÃO',
    iapsRef:  'Referência do capítulo com audioreferência — IAPs · Bruscia (1987)',
    listenBtn: 'Ouvir Explicação',
    stopBtn:   'Parar Explicação',
    learnMore: 'Saiba mais →',
    roles: ['Dependente', 'Seguidor', 'Parceiro', 'Líder', 'Resistente'],
    descriptions: [
      'Assume o papel de seguidor exclusivamente, sem propor mudanças ou liderar.',
      'Há maior prontidão para seguir do que para liderar, mantendo-se na zona de resposta.',
      'Os papéis de liderança e resposta alternam-se de forma fluida e igualitária.',
      'Assume a frente da criação, propondo caminhos que o outro deve seguir.',
      'Evita ou tenta romper a relação de liderança ou seguimento estabelecida.',
    ],
    cardTexts: [
      'O músico assume o papel de seguidor exclusivamente, sem propor mudanças ou liderar.',
      'Há maior prontidão para seguir do que para liderar, mantendo-se na zona de resposta.',
      'Os papéis de liderança e resposta alternam-se de forma fluida e igualitária.',
      'O músico assume a frente da criação, propondo caminhos que o outro deve seguir.',
      'O músico evita ou tenta romper a relação estabelecida de liderança ou seguimento.',
    ],
    ui: {
      title:        'Painel de Controle',
      randMode:     '🔀 Modo Aleatório',
      btnStart:     'Iniciar',
      btnStop:      'Parar',
      btnBack:      '⬅ Voltar',
      btnNext:      'Avançar ➡',
      openTab:      'Tela de Projeção',
      audioOn:      '🔊 Áudio: ON',
      audioOff:     '🔇 Áudio: OFF',
      waiting:      'Aguardando...',
      namePlaceholder: 'nome...',
      participant:  'participante',
      participants: 'participantes',
      minTime:      'seg',
      connecting:   'Conectando...',
      connected:    'Conectado',
    },
  },
  en: {
    title:    'Autonomy Profile — Improvisation Assessment Profiles (IAPs)',
    subtitle: 'Improvisation in Music Therapy I · UFMG · Ivan Moriá Borges · 2026',
    intro:    'Hello! This tool was developed by professor and music therapist Ivan Moriá for the course Improvisation in Music Therapy I · UFMG. Click each card to explore bibliographic references on the improvisational profiles described by Kenneth Bruscia.',
    cardNote: 'INTERACTION LEVELS',
    iapsRef:  'Chapter reference with audio citation — IAPs · Bruscia (1987)',
    listenBtn: 'Listen to Explanation',
    stopBtn:   'Stop Explanation',
    learnMore: 'Learn more →',
    roles: ['Dependent', 'Follower', 'Partner', 'Leader', 'Resister'],
    descriptions: [
      'Takes the follower role exclusively, without proposing changes or leading.',
      'There is a greater readiness to follow than to lead, remaining primarily in the response role.',
      'Leadership and response roles alternate fluidly and equally.',
      'Takes the lead in the creation, proposing directions for the other to follow.',
      'Avoids or attempts to disrupt the established leader–follower relationship.',
    ],
    cardTexts: [
      'The musician takes the follower role exclusively, without proposing changes or leading.',
      'There is a greater readiness to follow than to lead, staying in the response zone.',
      'The roles of leadership and response alternate fluidly and equally.',
      'The musician takes the lead in creation, proposing paths for the other to follow.',
      'The musician avoids or attempts to break the established leader-follower relationship.',
    ],
    ui: {
      title:        'Control Panel',
      randMode:     '🔀 Random Mode',
      btnStart:     'Start',
      btnStop:      'Stop',
      btnBack:      '⬅ Back',
      btnNext:      'Next ➡',
      openTab:      'Projection Screen',
      audioOn:      '🔊 Audio: ON',
      audioOff:     '🔇 Audio: OFF',
      waiting:      'Waiting...',
      namePlaceholder: 'name...',
      participant:  'participant',
      participants: 'participants',
      minTime:      'sec',
      connecting:   'Connecting...',
      connected:    'Connected',
    },
  },
};
