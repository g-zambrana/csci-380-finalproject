// js/resources.js
// Controller for pages/resources.html

import { supabase, requireAuth } from './supabase.js';
import { getUserProfile }        from './services/userService.js';

// ── Auth guard ─────────────────────────────────────────────────
const user = await requireAuth();
if (!user) throw new Error('Not authenticated');

// ── Sidebar user info ─────────────────────────────────────────
try {
  const profile = await getUserProfile(user.id);
  const displayName =
    profile?.display_name ||
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.email.split('@')[0];
  const initials = displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  document.getElementById('avatar-initials').textContent  = initials;
  document.getElementById('sb-username').textContent      = displayName;
  document.getElementById('sb-useremail').textContent     = user.email;
} catch (e) {
  document.getElementById('sb-username').textContent  = user.email.split('@')[0];
  document.getElementById('sb-useremail').textContent = user.email;
}

// ── Logout ────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/login';
});

// ── Curated fallback resources ────────────────────────────────
// Used when the Supabase resources table is empty or inaccessible.
const FALLBACK_RESOURCES = [
  {
    id: 'f1', title: 'Understanding Anxiety', resource_type: 'article',
    description: 'A comprehensive guide to understanding what anxiety is, its symptoms, and evidence-based strategies to manage it day-to-day.',
    category: ['anxiety', 'mental health'],
    external_url: 'https://www.nimh.nih.gov/health/topics/anxiety-disorders',
    is_featured: true, emoji: '🧠',
    thumb_color: '#E8F5E9', source: 'NIH — National Institute of Mental Health',
  },
  {
    id: 'f2', title: '5-Minute Breathing Exercise', resource_type: 'exercise',
    description: 'A guided box-breathing technique that calms the nervous system in minutes. Perfect before a stressful event.',
    category: ['anxiety', 'mindfulness'],
    external_url: 'https://www.health.harvard.edu/mind-and-mood/relaxation-techniques-breath-control-helps-quell-errant-stress-response',
    is_featured: true, emoji: '🌬️',
    thumb_color: '#FFF3E0', source: 'Harvard Health Publishing',
  },
  {
    id: 'f3', title: 'Mood & Mental Health — A Ted Talk', resource_type: 'video',
    description: 'Guy Winch explains why we should treat emotional injuries with the same urgency as physical ones.',
    category: ['self-compassion', 'mental health'],
    external_url: 'https://www.ted.com/talks/guy_winch_the_case_for_emotional_hygiene',
    is_featured: true, emoji: '🎥',
    thumb_color: '#E3F2FD', source: 'TED Talks',
  },
  {
    id: 'f4', title: 'Sleep Hygiene Guide', resource_type: 'article',
    description: 'Learn why sleep is foundational to mental health and get 12 actionable tips for better rest tonight.',
    category: ['sleep', 'wellness'],
    external_url: 'https://sleepeducation.org/sleep-hygiene/',
    is_featured: false, emoji: '😴',
    thumb_color: '#EDE7F6', source: 'American Academy of Sleep Medicine',
  },
  {
    id: 'f5', title: 'CBT Thought Record Worksheet', resource_type: 'worksheet',
    description: 'A printable Cognitive Behavioral Therapy worksheet to identify negative automatic thoughts and reframe them.',
    category: ['CBT', 'depression', 'anxiety'],
    external_url: 'https://www.therapistaid.com/therapy-worksheet/cbt-thought-record',
    is_featured: false, emoji: '📋',
    thumb_color: '#FFF8E1', source: 'Therapist Aid',
  },
  {
    id: 'f6', title: 'Mindfulness Meditation (Guided Audio)', resource_type: 'audio',
    description: 'A free 10-minute guided mindfulness session to ground you in the present moment and reduce rumination.',
    category: ['mindfulness', 'stress'],
    external_url: 'https://www.mindful.org/a-five-minute-breathing-meditation/',
    is_featured: false, emoji: '🎧',
    thumb_color: '#F3E5F5', source: 'Mindful.org',
  },
  {
    id: 'f7', title: 'Dealing with Depression', resource_type: 'article',
    description: 'An accessible overview of depression — signs, causes, treatments — with links to professional help.',
    category: ['depression', 'mental health'],
    external_url: 'https://www.nimh.nih.gov/health/topics/depression',
    is_featured: false, emoji: '💙',
    thumb_color: '#E1F5FE', source: 'NIH — National Institute of Mental Health',
  },
  {
    id: 'f8', title: 'Grounding Techniques for Trauma', resource_type: 'exercise',
    description: 'Practical 5-4-3-2-1 sensory grounding techniques that help anchor you when you feel overwhelmed or dissociated.',
    category: ['trauma', 'anxiety', 'mindfulness'],
    external_url: 'https://www.therapistaid.com/therapy-worksheet/grounding-techniques',
    is_featured: false, emoji: '🌱',
    thumb_color: '#E8F5E9', source: 'Therapist Aid',
  },
  {
    id: 'f9', title: 'Body Scan Meditation', resource_type: 'audio',
    description: 'A 15-minute progressive body scan audio to release tension and reconnect with physical sensations.',
    category: ['mindfulness', 'sleep', 'stress'],
    external_url: 'https://www.uclahealth.org/programs/marc/free-guided-meditations',
    is_featured: false, emoji: '🧘',
    thumb_color: '#F3E5F5', source: 'UCLA Mindful Awareness Research Center',
  },
  {
    id: 'f10', title: 'Building Healthy Habits', resource_type: 'article',
    description: 'Science-backed strategies to build positive habits that stick — from behavioral psychology research.',
    category: ['wellness', 'habits'],
    external_url: 'https://www.apa.org/topics/behavioral-health/habit-formation',
    is_featured: false, emoji: '⚡',
    thumb_color: '#FFFDE7', source: 'American Psychological Association',
  },
  {
    id: 'f11', title: 'Crisis Resource Directory', resource_type: 'article',
    description: 'A curated list of crisis lines, peer support groups, and emergency resources for a wide range of needs.',
    category: ['crisis', 'mental health'],
    external_url: 'https://www.samhsa.gov/find-help',
    is_featured: false, emoji: '🆘',
    thumb_color: '#FFEBEE', source: 'SAMHSA',
  },
  {
    id: 'f12', title: 'Journaling for Mental Health', resource_type: 'article',
    description: 'Research on how expressive writing reduces stress and improves wellbeing, with prompts to get you started.',
    category: ['journaling', 'stress', 'self-compassion'],
    external_url: 'https://www.urmc.rochester.edu/encyclopedia/content?contentid=4552&contenttypeid=1',
    is_featured: false, emoji: '📓',
    thumb_color: '#E8F5E9', source: 'University of Rochester Medical Center',
  },
];

// ── Type → badge config ───────────────────────────────────────
const BADGE = {
  article:   { cls: 'badge-article',   label: 'Article',   icon: '📄' },
  video:     { cls: 'badge-video',     label: 'Video',     icon: '🎥' },
  exercise:  { cls: 'badge-exercise',  label: 'Exercise',  icon: '🧘' },
  audio:     { cls: 'badge-audio',     label: 'Audio',     icon: '🎧' },
  worksheet: { cls: 'badge-worksheet', label: 'Worksheet', icon: '📋' },
};

// ── Build a resource card element ─────────────────────────────
function buildCard(res, featured = false) {
  const badge  = BADGE[res.resource_type] ?? BADGE.article;
  const cats   = (res.category ?? []).slice(0, 3);
  const url    = res.external_url || '#';
  const color  = res.thumb_color ?? '#F2EFE8';
  const emoji  = res.emoji ?? '📚';
  const source = res.source ?? '';

  const a = document.createElement('a');
  a.className     = `resource-card${featured ? ' featured' : ''}`;
  a.href          = url;
  a.target        = '_blank';
  a.rel           = 'noopener noreferrer';
  a.dataset.type  = res.resource_type;
  a.dataset.title = (res.title ?? '').toLowerCase();
  a.dataset.cats  = cats.join(',').toLowerCase();

  a.innerHTML = `
    <div class="card-thumb" style="background:${color}">${emoji}</div>
    <div class="card-body">
      <span class="card-badge ${badge.cls}">${badge.icon} ${badge.label}</span>
      <div class="card-title">${res.title ?? 'Untitled'}</div>
      <div class="card-desc">${res.description ?? ''}</div>
      <div class="card-footer">
        <div class="card-tags">
          ${cats.map(c => `<span class="tag">${c}</span>`).join('')}
        </div>
        <a class="card-link" href="${url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
          ${source ? source : 'Open'} ↗
        </a>
      </div>
    </div>`;
  return a;
}

// ── Attempt to load from Supabase; fall back to static list ───
async function loadResources() {
  let resources = [];
  try {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('is_published', true)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error && data && data.length > 0) {
      resources = data;
    } else {
      resources = FALLBACK_RESOURCES;
    }
  } catch (_) {
    resources = FALLBACK_RESOURCES;
  }
  return resources;
}

// ── Render ────────────────────────────────────────────────────
const allResources = await loadResources();

const featuredEl  = document.getElementById('featured-grid');
const featuredSec = document.getElementById('featured-section');
const gridEl      = document.getElementById('resource-grid');

const featured = allResources.filter(r => r.is_featured);
const rest      = allResources.filter(r => !r.is_featured);

if (featured.length === 0) {
  featuredSec.style.display = 'none';
} else {
  featured.forEach(r => featuredEl.appendChild(buildCard(r, true)));
}

function renderGrid(items) {
  gridEl.innerHTML = '';
  if (items.length === 0) {
    gridEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔍</div>
        <p>No resources match your filters.<br>Try a different category or search term.</p>
      </div>`;
    return;
  }
  items.forEach(r => gridEl.appendChild(buildCard(r, false)));
}

renderGrid(rest);

// ── Filter + search ───────────────────────────────────────────
let activeFilter = 'all';
let searchTerm   = '';

function applyFilters() {
  let pool = allResources.filter(r => !r.is_featured);

  if (activeFilter !== 'all') {
    pool = pool.filter(r => r.resource_type === activeFilter);
  }
  if (searchTerm) {
    pool = pool.filter(r =>
      r.title?.toLowerCase().includes(searchTerm) ||
      r.description?.toLowerCase().includes(searchTerm) ||
      (r.category ?? []).some(c => c.toLowerCase().includes(searchTerm))
    );
  }

  // Also filter featured when a filter is active
  if (activeFilter !== 'all' || searchTerm) {
    featuredSec.style.display = 'none';
  } else {
    featuredSec.style.display = featured.length > 0 ? '' : 'none';
  }

  renderGrid(pool);
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    applyFilters();
  });
});

document.getElementById('res-search').addEventListener('input', e => {
  searchTerm = e.target.value.trim().toLowerCase();
  applyFilters();
});
