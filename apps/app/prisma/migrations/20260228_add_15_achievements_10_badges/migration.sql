-- ============================================================
-- 1. CLEAN EXISTING DATA (SAFE ORDER)
-- ============================================================

DELETE FROM achievement_unlocks;
DELETE FROM achievement_progress;
DELETE FROM achievements;

DELETE FROM badge_grants;
DELETE FROM badges;

-- ============================================================
-- 2. INSERT ACHIEVEMENTS (15 TOTAL)
-- ============================================================

INSERT INTO achievements (id, type, name, description, criteria, points, rarity, icon, "createdAt")
VALUES

-- COMMON
('ach_first_steps','FIRST_DOUBT','First Steps',
 'Complete your first doubt',
 '{"requirementType":"DOUBTS_ASKED","target":1}',
 50,'COMMON','🎯',NOW()),

('ach_first_helper','FIRST_COMMENT','First Helper',
 'Post your first answer',
 '{"requirementType":"ANSWERS_POSTED","target":1}',
 50,'COMMON','🤝',NOW()),

-- UNCOMMON
('ach_knowledge_seeker','KNOWLEDGE_SEEKER','Knowledge Seeker',
 'Ask 100 questions',
 '{"requirementType":"DOUBTS_ASKED","target":100}',
 150,'UNCOMMON','💡',NOW()),

('ach_quick_learner','COMMUNITY_LEADER','Quick Learner',
 'Complete 10 courses',
 '{"requirementType":"COURSES_COMPLETED","target":10}',
 200,'UNCOMMON','⭐',NOW()),

('ach_problem_solver','PROBLEM_SOLVER','Problem Solver',
 'Solve 50 doubts',
 '{"requirementType":"DOUBTS_RESOLVED","target":50}',
 250,'UNCOMMON','🔧',NOW()),

-- RARE
('ach_streak_master','STREAK_MASTER','Streak Master',
 'Maintain 30-day streak',
 '{"requirementType":"CONSECUTIVE_DAYS","target":30}',
 300,'RARE','🔥',NOW()),

('ach_code_master','SUBJECT_EXPERT','Code Master',
 'Solve 50 coding problems',
 '{"requirementType":"CODING_PROBLEMS_SOLVED","target":50}',
 400,'RARE','💻',NOW()),

('ach_helper_extra','RISING_STAR','Helper Extraordinaire',
 'Post 200 helpful answers',
 '{"requirementType":"HELPFUL_ANSWERS","target":200}',
 350,'RARE','❤️',NOW()),

-- EPIC
('ach_mentor','MENTOR','Mentor',
 'Help 100 students',
 '{"requirementType":"STUDENTS_HELPED","target":100}',
 500,'EPIC','🎓',NOW()),

('ach_community_champion','COMMUNITY_LEADER','Community Champion',
 'Earn 10,000 reputation',
 '{"requirementType":"REPUTATION","target":10000}',
 600,'EPIC','👥',NOW()),

('ach_research_star','RISING_STAR','Research Star',
 'Contribute 5 research articles',
 '{"requirementType":"RESEARCH_ARTICLES","target":5}',
 550,'EPIC','📚',NOW()),

('ach_subject_master','SUBJECT_EXPERT','Subject Master',
 'Master 3 subjects',
 '{"requirementType":"SUBJECTS_MASTERED","target":3}',
 650,'EPIC','📊',NOW()),

-- LEGENDARY
('ach_ai_master','TOP_CONTRIBUTOR','AI Master',
 'Master AI concepts',
 '{"requirementType":"AI_MASTERY","target":100}',
 1000,'LEGENDARY','⚡',NOW()),

('ach_consistency_wins','TOP_CONTRIBUTOR','Consistency Wins',
 'Maintain 60-day streak',
 '{"requirementType":"CONSECUTIVE_DAYS","target":60}',
 800,'LEGENDARY','🎯',NOW()),

('ach_legend_status','TOP_CONTRIBUTOR','Legend Status',
 'Reach 50,000 total reputation',
 '{"requirementType":"REPUTATION","target":50000}',
 1500,'LEGENDARY','👑',NOW());

-- ============================================================
-- 3. INSERT BADGES (10 TOTAL)
-- ============================================================

INSERT INTO badges (id,type,name,description,icon,color,"createdAt")
VALUES

('badge_code_ninja','CODE_NINJA','Code Ninja',
 'Expert in coding problems','💻','bg-blue-500',NOW()),

('badge_math_wizard','MATH_WIZARD','Math Wizard',
 'Master of mathematics','🔢','bg-purple-500',NOW()),

('badge_physics_guru','PHYSICS_GURU','Physics Guru',
 'Expert in physics concepts','⚛️','bg-cyan-500',NOW()),

('badge_bio_expert','BIO_EXPERT','Bio Expert',
 'Master of biology','🧬','bg-green-500',NOW()),

('badge_ai_master','AI_MASTER','AI Master',
 'Expert in artificial intelligence','🤖','bg-yellow-500',NOW()),

('badge_problem_solver','PROBLEM_SOLVER','Problem Solver',
 'Exceptional problem solver','🎯','bg-orange-500',NOW()),

('badge_helper','HELPER','Community Helper',
 'Dedicated to helping others','🤝','bg-pink-500',NOW()),

('badge_research_star','RESEARCH_STAR','Research Star',
 'Excellent researcher','📡','bg-indigo-500',NOW()),

('badge_innovator','INNOVATOR','Innovator',
 'Brings innovative solutions','💡','bg-lime-500',NOW()),

('badge_tutor','TUTOR','Tutor',
 'Excellent at teaching others','📖','bg-rose-500',NOW());
