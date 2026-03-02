"""
NOVYRA — Universal Knowledge Graph Concept Seeder

Seeds a comprehensive, production-quality concept dependency graph.
This creates the "brain" of NOVYRA that judges will see in action.

🎓 Domains Covered (200+ concepts across 25+ disciplines):

STEM Fields:
- Computer Science (Data Structures, Algorithms, Machine Learning)
- Mathematics (Algebra, Calculus, Statistics, Linear Algebra)
- Physics (Mechanics, Thermodynamics, Quantum Mechanics, Electromagnetism)
- Chemistry (Organic, Inorganic, Physical Chemistry, Electrochemistry)
- Biology (Genetics, Ecology, Human Anatomy, Immunology)
- Engineering (Mechanical, Electrical, Materials, Control Systems)
- Data Science (ML, Deep Learning, Big Data Technologies)
- Environmental Science (Climate Change, Sustainability, Conservation)
- Astronomy (Solar System, Cosmology, Stellar Evolution)
- Health Sciences (Anatomy, Pharmacology, Public Health, Epidemiology)
- Agriculture (Crop Production, Soil Science, Sustainable Farming)

Social Sciences:
- Economics (Micro, Macro, International Trade, Elasticity)
- Psychology (Cognitive, Social, Developmental, Abnormal)
- Sociology (Social Structures, Inequality, Culture, Deviance)
- Anthropology (Cultural, Physical, Archaeology, Ethnography)
- Political Science (Comparative, International Relations, Public Policy)
- Geography (Physical, Human, Geopolitics, Urban Planning)

Humanities:
- History (Ancient to Modern Global History, World Wars, Cold War)
- Literature (Poetry, Prose, Drama, Critical Theory, Creative Writing)
- Philosophy (Ethics, Logic, Metaphysics, Epistemology, Political)
- Languages & Linguistics (Grammar, Syntax, Semantics, Pragmatics)
- Communications & Media Studies (Journalism, Digital Media, Mass Communication)

Professional & Applied:
- Business (Finance, Marketing, Strategy, Entrepreneurship)
- Law (Contract, Criminal, Constitutional, Torts, Property)
- Architecture (Design, Structural, Sustainable, Urban Design)

Creative Arts:
- Visual Arts (Drawing, Painting, Digital Art, Sculpture, Art History)
- Music (Theory, Composition, Performance, Ear Training, History)

This demonstrates NOVYRA as a true universal learning platform,
capable of guiding learners through ANY academic discipline with
intelligent prerequisite tracking and adaptive pathways.
"""
from __future__ import annotations
import logging
from typing import List, Dict, Tuple

from app.services import knowledge_graph_service as kg

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Concept definitions with dependency graph
# ---------------------------------------------------------------------------

# Format: (concept_name, description, domain, difficulty, [prerequisites])
CONCEPTS: List[Tuple[str, str, str, int, List[str]]] = [
    # ----- Computer Science -----
    ("Variables", "Basic variable assignment and types", "Computer Science", 1, []),
    ("Arrays", "Sequential data structures with index-based access", "Computer Science", 2, ["Variables"]),
    ("Strings", "Text manipulation and character arrays", "Computer Science", 2, ["Variables", "Arrays"]),
    ("Linked Lists", "Dynamic node-based linear data structures", "Computer Science", 3, ["Arrays"]),
    ("Stacks", "LIFO data structure", "Computer Science", 3, ["Arrays"]),
    ("Queues", "FIFO data structure", "Computer Science", 3, ["Arrays"]),
    ("Hash Tables", "Key-value mapping with O(1) average lookup", "Computer Science", 4, ["Arrays"]),
    ("Trees", "Hierarchical data structures", "Computer Science", 4, ["Linked Lists"]),
    ("Binary Trees", "Trees with max 2 children per node", "Computer Science", 5, ["Trees"]),
    ("Binary Search Trees", "Ordered binary trees", "Computer Science", 5, ["Binary Trees"]),
    ("Graphs", "Network structures with vertices and edges", "Computer Science", 6, ["Trees"]),
    ("Linear Search", "Sequential search through elements", "Computer Science", 2, ["Arrays"]),
    ("Binary Search", "Divide-and-conquer search on sorted data", "Computer Science", 4, ["Arrays", "Linear Search"]),
    ("Recursion", "Function calling itself to solve problems", "Computer Science", 4, ["Variables"]),
    ("Sorting Algorithms", "Understanding comparison and stability", "Computer Science", 3, ["Arrays"]),
    ("Dynamic Programming", "Optimal substructure with memoization", "Computer Science", 7, ["Recursion"]),
    ("Machine Learning Basics", "Introduction to ML algorithms and training", "Computer Science", 7, ["Sorting Algorithms", "Graphs"]),
    
    # ----- Mathematics -----
    ("Basic Arithmetic", "Addition, subtraction, multiplication, division", "Mathematics", 1, []),
    ("Integers", "Whole numbers and their properties", "Mathematics", 1, ["Basic Arithmetic"]),
    ("Fractions", "Rational number representation", "Mathematics", 2, ["Integers"]),
    ("Decimals", "Base-10 fractional representation", "Mathematics", 2, ["Fractions"]),
    ("Algebra Basics", "Variable manipulation and equations", "Mathematics", 3, ["Integers"]),
    ("Linear Equations", "First-degree polynomial equations", "Mathematics", 4, ["Algebra Basics"]),
    ("Quadratic Equations", "Second-degree polynomial equations", "Mathematics", 5, ["Linear Equations"]),
    ("Functions", "Mapping from inputs to outputs", "Mathematics", 4, ["Algebra Basics"]),
    ("Limits", "Understanding function behavior at boundaries", "Mathematics", 6, ["Functions"]),
    ("Derivatives", "Rate of change and slopes", "Mathematics", 7, ["Limits"]),
    ("Integrals", "Area under curves and antiderivatives", "Mathematics", 7, ["Derivatives"]),
    ("Linear Algebra", "Vector spaces and matrix operations", "Mathematics", 6, ["Algebra Basics"]),
    ("Statistics Basics", "Data collection and descriptive statistics", "Mathematics", 4, ["Basic Arithmetic"]),
    ("Probability", "Likelihood and random events", "Mathematics", 5, ["Fractions", "Statistics Basics"]),
    ("Trigonometry", "Relationships between angles and sides", "Mathematics", 5, ["Functions"]),
    
    # ----- Physics -----
    ("Measurement Units", "SI units and conversions", "Physics", 1, []),
    ("Kinematics", "Motion without considering forces", "Physics", 3, ["Measurement Units", "Algebra Basics"]),
    ("Velocity and Acceleration", "Rate of position change", "Physics", 4, ["Kinematics", "Derivatives"]),
    ("Newton's Laws", "Fundamental laws of motion", "Physics", 5, ["Velocity and Acceleration"]),
    ("Work and Energy", "Energy transfer through forces", "Physics", 6, ["Newton's Laws"]),
    ("Momentum", "Mass in motion and collisions", "Physics", 6, ["Newton's Laws"]),
    ("Thermodynamics", "Heat, energy, and entropy", "Physics", 7, ["Work and Energy"]),
    ("Electromagnetism", "Electric and magnetic field interactions", "Physics", 7, ["Newton's Laws"]),
    ("Waves and Optics", "Wave propagation and light behavior", "Physics", 6, ["Trigonometry"]),
    ("Quantum Mechanics", "Subatomic particle behavior", "Physics", 9, ["Waves and Optics", "Probability"]),
    
    # ----- Chemistry -----
    ("Atomic Structure", "Protons, neutrons, electrons and organization", "Chemistry", 3, []),
    ("Periodic Table", "Element organization and properties", "Chemistry", 3, ["Atomic Structure"]),
    ("Chemical Bonding", "Ionic, covalent, and metallic bonds", "Chemistry", 4, ["Periodic Table"]),
    ("Stoichiometry", "Quantitative relationships in reactions", "Chemistry", 5, ["Chemical Bonding", "Basic Arithmetic"]),
    ("Chemical Reactions", "Types and balancing equations", "Chemistry", 4, ["Chemical Bonding"]),
    ("Acids and Bases", "pH scale and neutralization", "Chemistry", 5, ["Chemical Reactions"]),
    ("Thermochemistry", "Energy changes in reactions", "Chemistry", 6, ["Stoichiometry", "Thermodynamics"]),
    ("Organic Chemistry", "Carbon-based compound chemistry", "Chemistry", 7, ["Chemical Bonding"]),
    ("Electrochemistry", "Redox reactions and batteries", "Chemistry", 6, ["Chemical Reactions"]),
    
    # ----- Biology -----
    ("Cell Structure", "Prokaryotic and eukaryotic cell components", "Biology", 3, []),
    ("Cell Membrane", "Transport and cell membrane function", "Biology", 4, ["Cell Structure"]),
    ("DNA Structure", "Double helix and genetic information storage", "Biology", 4, ["Cell Structure"]),
    ("Protein Synthesis", "Transcription and translation processes", "Biology", 5, ["DNA Structure"]),
    ("Cell Division", "Mitosis and meiosis", "Biology", 5, ["DNA Structure"]),
    ("Genetics", "Inheritance patterns and Mendelian laws", "Biology", 6, ["Cell Division"]),
    ("Evolution", "Natural selection and speciation", "Biology", 6, ["Genetics"]),
    ("Ecology", "Ecosystems and organism interactions", "Biology", 5, ["Evolution"]),
    ("Photosynthesis", "Light energy conversion in plants", "Biology", 5, ["Cell Structure", "Chemical Reactions"]),
    ("Human Anatomy", "Body systems and organ functions", "Biology", 5, ["Cell Structure"]),
    ("Immunology", "Immune system and disease defense", "Biology", 7, ["Protein Synthesis", "Human Anatomy"]),
    
    # ----- Economics -----
    ("Supply and Demand", "Market equilibrium and price determination", "Economics", 3, []),
    ("Opportunity Cost", "Trade-offs in decision making", "Economics", 2, []),
    ("Market Structures", "Competition types and market behavior", "Economics", 4, ["Supply and Demand"]),
    ("Elasticity", "Price sensitivity and demand response", "Economics", 5, ["Supply and Demand", "Fractions"]),
    ("GDP and Economic Growth", "National income measurement", "Economics", 5, ["Market Structures"]),
    ("Inflation", "Price level changes over time", "Economics", 5, ["GDP and Economic Growth"]),
    ("Monetary Policy", "Central bank and money supply control", "Economics", 6, ["Inflation"]),
    ("Fiscal Policy", "Government spending and taxation", "Economics", 6, ["GDP and Economic Growth"]),
    ("International Trade", "Comparative advantage and trade", "Economics", 6, ["Supply and Demand"]),
    
    # ----- Psychology -----
    ("Introduction to Psychology", "Scientific study of mind and behavior", "Psychology", 2, []),
    ("Research Methods", "Experiments and data collection in psychology", "Psychology", 3, ["Introduction to Psychology", "Statistics Basics"]),
    ("Biological Psychology", "Brain structure and neurotransmitters", "Psychology", 4, ["Introduction to Psychology"]),
    ("Sensation and Perception", "How we sense and interpret stimuli", "Psychology", 4, ["Biological Psychology"]),
    ("Learning Theories", "Classical and operant conditioning", "Psychology", 4, ["Introduction to Psychology"]),
    ("Memory", "Encoding, storage, and retrieval processes", "Psychology", 5, ["Learning Theories"]),
    ("Cognitive Psychology", "Mental processes and problem solving", "Psychology", 6, ["Memory"]),
    ("Developmental Psychology", "Human development across lifespan", "Psychology", 5, ["Introduction to Psychology"]),
    ("Social Psychology", "Group behavior and social influence", "Psychology", 5, ["Introduction to Psychology"]),
    ("Abnormal Psychology", "Mental disorders and treatments", "Psychology", 6, ["Introduction to Psychology"]),
    
    # ----- History -----
    ("Ancient Civilizations", "Early human societies and cultures", "History", 3, []),
    ("Classical Greece and Rome", "Greek and Roman empires", "History", 4, ["Ancient Civilizations"]),
    ("Medieval Europe", "Feudalism and Middle Ages", "History", 4, ["Classical Greece and Rome"]),
    ("Renaissance", "Cultural rebirth in Europe", "History", 5, ["Medieval Europe"]),
    ("Age of Exploration", "European global expansion", "History", 5, ["Renaissance"]),
    ("Industrial Revolution", "Mechanization and social change", "History", 5, ["Age of Exploration"]),
    ("World War I", "Great War causes and consequences", "History", 6, ["Industrial Revolution"]),
    ("World War II", "Global conflict 1939-1945", "History", 6, ["World War I"]),
    ("Cold War", "US-Soviet tension and proxy conflicts", "History", 6, ["World War II"]),
    ("Modern Global History", "Contemporary world developments", "History", 7, ["Cold War"]),
    
    # ----- Literature -----
    ("Literary Elements", "Plot, character, setting, theme", "Literature", 2, []),
    ("Poetry Analysis", "Understanding poetic devices and forms", "Literature", 4, ["Literary Elements"]),
    ("Prose Fiction", "Short stories and novel structure", "Literature", 3, ["Literary Elements"]),
    ("Drama and Theater", "Plays and dramatic structure", "Literature", 4, ["Literary Elements"]),
    ("Literary Movements", "Romanticism, Realism, Modernism", "Literature", 6, ["Prose Fiction"]),
    ("Critical Theory", "Frameworks for literary analysis", "Literature", 7, ["Literary Movements"]),
    ("Comparative Literature", "Cross-cultural literary study", "Literature", 7, ["Literary Movements"]),
    ("Creative Writing", "Crafting original fiction and poetry", "Literature", 5, ["Poetry Analysis", "Prose Fiction"]),
    
    # ----- Engineering -----
    ("Engineering Fundamentals", "Problem solving and design thinking", "Engineering", 3, ["Basic Arithmetic"]),
    ("Statics", "Forces in equilibrium", "Engineering", 5, ["Newton's Laws", "Trigonometry"]),
    ("Dynamics", "Motion and forces in systems", "Engineering", 6, ["Statics", "Velocity and Acceleration"]),
    ("Thermodynamics Engineering", "Heat engines and energy systems", "Engineering", 6, ["Thermodynamics", "Engineering Fundamentals"]),
    ("Fluid Mechanics", "Fluid flow and properties", "Engineering", 7, ["Dynamics"]),
    ("Electrical Circuits", "Current, voltage, and circuit analysis", "Engineering", 5, ["Electromagnetism", "Algebra Basics"]),
    ("Materials Science", "Properties and selection of materials", "Engineering", 5, ["Chemical Bonding"]),
    ("Control Systems", "Feedback and system stability", "Engineering", 7, ["Electrical Circuits", "Derivatives"]),
    
    # ----- Business -----
    ("Business Fundamentals", "Organizations and value creation", "Business", 2, []),
    ("Marketing", "Customer needs and promotion strategies", "Business", 4, ["Business Fundamentals"]),
    ("Financial Accounting", "Recording and reporting transactions", "Business", 4, ["Basic Arithmetic", "Business Fundamentals"]),
    ("Managerial Accounting", "Decision-making with financial data", "Business", 5, ["Financial Accounting"]),
    ("Corporate Finance", "Investment and capital structure", "Business", 6, ["Managerial Accounting", "Probability"]),
    ("Operations Management", "Process efficiency and supply chain", "Business", 5, ["Business Fundamentals"]),
    ("Strategic Management", "Competitive advantage and planning", "Business", 7, ["Marketing", "Corporate Finance"]),
    ("Entrepreneurship", "Starting and growing ventures", "Business", 6, ["Business Fundamentals"]),
    
    # ----- Philosophy -----
    ("Introduction to Philosophy", "Fundamental questions and methods", "Philosophy", 3, []),
    ("Logic", "Valid reasoning and argumentation", "Philosophy", 4, ["Introduction to Philosophy"]),
    ("Ethics", "Moral theories and decision making", "Philosophy", 5, ["Introduction to Philosophy"]),
    ("Epistemology", "Nature and sources of knowledge", "Philosophy", 6, ["Logic"]),
    ("Metaphysics", "Reality, existence, and being", "Philosophy", 6, ["Introduction to Philosophy"]),
    ("Political Philosophy", "Justice, rights, and governance", "Philosophy", 6, ["Ethics"]),
    ("Philosophy of Mind", "Consciousness and mental states", "Philosophy", 7, ["Epistemology", "Cognitive Psychology"]),
    
    # ----- Geography -----
    ("Physical Geography", "Earth's physical features and processes", "Geography", 3, []),
    ("Climate and Weather", "Atmospheric conditions and patterns", "Geography", 4, ["Physical Geography"]),
    ("Human Geography", "Population distribution and culture", "Geography", 4, ["Physical Geography"]),
    ("Geopolitics", "Territorial politics and resources", "Geography", 5, ["Human Geography"]),
    ("Urban Planning", "City design and development", "Geography", 6, ["Human Geography"]),
    ("Environmental Geography", "Human-environment interactions", "Geography", 6, ["Climate and Weather", "Ecology"]),
    
    # ----- Art -----
    ("Art Fundamentals", "Elements and principles of design", "Art", 2, []),
    ("Drawing Techniques", "Line, form, and shading", "Art", 3, ["Art Fundamentals"]),
    ("Color Theory", "Color relationships and mixing", "Art", 4, ["Art Fundamentals"]),
    ("Painting Methods", "Techniques in various media", "Art", 5, ["Color Theory", "Drawing Techniques"]),
    ("Art History", "Major movements and artists", "Art", 5, ["Art Fundamentals"]),
    ("Sculpture", "Three-dimensional art creation", "Art", 6, ["Art Fundamentals"]),
    ("Digital Art", "Computer-based artistic creation", "Art", 5, ["Art Fundamentals"]),
    
    # ----- Music -----
    ("Music Fundamentals", "Rhythm, pitch, and notation", "Music", 2, []),
    ("Music Theory", "Harmony, scales, and chord progressions", "Music", 4, ["Music Fundamentals"]),
    ("Ear Training", "Recognizing intervals and chords", "Music", 5, ["Music Theory"]),
    ("Music History", "Evolution of musical styles", "Music", 5, ["Music Fundamentals"]),
    ("Composition", "Creating original musical works", "Music", 7, ["Music Theory"]),
    ("Music Performance", "Instrumental and vocal techniques", "Music", 5, ["Music Fundamentals"]),
    
    # ----- Languages & Linguistics -----
    ("Basic Grammar", "Parts of speech and sentence structure", "Languages", 2, []),
    ("Vocabulary Building", "Word acquisition and usage", "Languages", 2, []),
    ("Reading Comprehension", "Understanding written text", "Languages", 3, ["Basic Grammar", "Vocabulary Building"]),
    ("Writing Skills", "Composition and expression", "Languages", 4, ["Basic Grammar"]),
    ("Phonetics", "Speech sounds and pronunciation", "Languages", 4, ["Vocabulary Building"]),
    ("Syntax", "Sentence structure rules", "Languages", 5, ["Basic Grammar"]),
    ("Semantics", "Meaning in language", "Languages", 5, ["Syntax"]),
    ("Pragmatics", "Context and language use", "Languages", 6, ["Semantics"]),
    ("Second Language Acquisition", "Learning additional languages", "Languages", 5, ["Basic Grammar", "Phonetics"]),
    ("Linguistics Theory", "Scientific study of language", "Languages", 7, ["Syntax", "Semantics"]),
    
    # ----- Sociology -----
    ("Introduction to Sociology", "Study of society and social behavior", "Sociology", 3, []),
    ("Social Structures", "Institutions and organizations", "Sociology", 4, ["Introduction to Sociology"]),
    ("Culture and Society", "Shared beliefs and practices", "Sociology", 4, ["Introduction to Sociology"]),
    ("Social Stratification", "Class, status, and inequality", "Sociology", 5, ["Social Structures"]),
    ("Race and Ethnicity", "Social construction of identity", "Sociology", 5, ["Culture and Society"]),
    ("Gender Studies", "Social roles and gender identity", "Sociology", 5, ["Culture and Society"]),
    ("Deviance and Crime", "Social norms and violations", "Sociology", 6, ["Social Structures"]),
    ("Urban Sociology", "City life and urbanization", "Sociology", 6, ["Social Structures"]),
    ("Sociological Theory", "Classical and contemporary theories", "Sociology", 7, ["Introduction to Sociology"]),
    
    # ----- Anthropology -----
    ("Introduction to Anthropology", "Study of humans and cultures", "Anthropology", 3, []),
    ("Cultural Anthropology", "Contemporary human cultures", "Anthropology", 4, ["Introduction to Anthropology"]),
    ("Physical Anthropology", "Human evolution and biology", "Anthropology", 4, ["Introduction to Anthropology", "Evolution"]),
    ("Archaeology", "Past human societies through artifacts", "Anthropology", 5, ["Introduction to Anthropology"]),
    ("Linguistic Anthropology", "Language in cultural context", "Anthropology", 5, ["Cultural Anthropology", "Linguistics Theory"]),
    ("Ethnography", "Fieldwork and cultural description", "Anthropology", 6, ["Cultural Anthropology"]),
    
    # ----- Political Science -----
    ("Introduction to Politics", "Power, governance, and authority", "Political Science", 3, []),
    ("Comparative Politics", "Political systems across countries", "Political Science", 5, ["Introduction to Politics"]),
    ("International Relations", "Global politics and diplomacy", "Political Science", 5, ["Introduction to Politics"]),
    ("Political Theory", "Ideas about government and justice", "Political Science", 6, ["Introduction to Politics"]),
    ("Public Policy", "Government decision-making", "Political Science", 6, ["Introduction to Politics"]),
    ("Constitutional Law", "Legal foundations of government", "Political Science", 7, ["Political Theory"]),
    
    # ----- Environmental Science -----
    ("Environmental Systems", "Earth's interconnected systems", "Environmental Science", 3, ["Physical Geography"]),
    ("Climate Change", "Global warming causes and effects", "Environmental Science", 5, ["Climate and Weather", "Chemistry"]),
    ("Biodiversity", "Species variety and conservation", "Environmental Science", 4, ["Ecology"]),
    ("Pollution and Toxicology", "Environmental contaminants", "Environmental Science", 5, ["Chemistry", "Environmental Systems"]),
    ("Sustainable Development", "Balancing growth and environment", "Environmental Science", 6, ["Environmental Systems", "Economics"]),
    ("Renewable Energy", "Clean energy sources", "Environmental Science", 6, ["Physics", "Climate Change"]),
    ("Conservation Biology", "Protecting species and habitats", "Environmental Science", 7, ["Biodiversity", "Ecology"]),
    
    # ----- Health Sciences -----
    ("Human Body Systems", "Overview of anatomy and physiology", "Health Sciences", 3, ["Biology"]),
    ("Nutrition", "Food and health relationships", "Health Sciences", 4, ["Human Body Systems", "Chemistry"]),
    ("Pharmacology", "Drugs and their effects", "Health Sciences", 6, ["Human Body Systems", "Organic Chemistry"]),
    ("Epidemiology", "Disease patterns in populations", "Health Sciences", 6, ["Statistics Basics", "Human Body Systems"]),
    ("Public Health", "Community health promotion", "Health Sciences", 5, ["Epidemiology"]),
    ("Medical Ethics", "Ethical issues in healthcare", "Health Sciences", 6, ["Ethics", "Human Body Systems"]),
    
    # ----- Law -----
    ("Legal Systems", "Common law, civil law foundations", "Law", 4, []),
    ("Contract Law", "Agreements and obligations", "Law", 5, ["Legal Systems"]),
    ("Criminal Law", "Crimes and punishments", "Law", 5, ["Legal Systems"]),
    ("Torts", "Civil wrongs and remedies", "Law", 6, ["Legal Systems"]),
    ("Property Law", "Rights in things and land", "Law", 6, ["Legal Systems"]),
    ("Constitutional Rights", "Individual rights and freedoms", "Law", 7, ["Constitutional Law"]),
    
    # ----- Architecture -----
    ("Architectural Design Principles", "Form, function, and aesthetics", "Architecture", 4, ["Art Fundamentals"]),
    ("Building Materials", "Properties and applications", "Architecture", 4, ["Materials Science"]),
    ("Structural Design", "Load-bearing systems", "Architecture", 6, ["Statics", "Building Materials"]),
    ("Sustainable Architecture", "Green building practices", "Architecture", 6, ["Architectural Design Principles", "Environmental Systems"]),
    ("Urban Design", "City planning and public spaces", "Architecture", 7, ["Architectural Design Principles", "Urban Planning"]),
    
    # ----- Communications & Media Studies -----
    ("Introduction to Communication", "Message creation and transmission", "Communications", 3, []),
    ("Media Literacy", "Critical analysis of media", "Communications", 4, ["Introduction to Communication"]),
    ("Public Speaking", "Effective oral presentation", "Communications", 4, ["Introduction to Communication"]),
    ("Journalism", "News gathering and reporting", "Communications", 5, ["Writing Skills", "Media Literacy"]),
    ("Digital Media", "Online and interactive content", "Communications", 5, ["Media Literacy"]),
    ("Mass Communication", "Broadcasting and mass audience", "Communications", 6, ["Introduction to Communication"]),
    ("Media Theory", "Critical frameworks for media analysis", "Communications", 7, ["Media Literacy", "Sociological Theory"]),
    
    # ----- Data Science -----
    ("Data Literacy", "Understanding data and visualization", "Data Science", 3, ["Statistics Basics"]),
    ("Data Cleaning", "Preparing data for analysis", "Data Science", 4, ["Data Literacy"]),
    ("Exploratory Data Analysis", "Discovering patterns in data", "Data Science", 5, ["Statistics Basics", "Data Cleaning"]),
    ("Statistical Modeling", "Mathematical models of data", "Data Science", 6, ["Probability", "Linear Algebra"]),
    ("Machine Learning", "Algorithms that learn from data", "Data Science", 7, ["Statistical Modeling", "Linear Algebra"]),
    ("Deep Learning", "Neural networks and AI", "Data Science", 8, ["Machine Learning", "Calculus Applications"]),
    ("Big Data Technologies", "Distributed computing for large datasets", "Data Science", 7, ["Data Literacy", "Algorithms"]),
    
    # ----- Agriculture -----
    ("Plant Biology", "Structure and function of plants", "Agriculture", 4, ["Cell Structure", "Photosynthesis"]),
    ("Soil Science", "Soil composition and fertility", "Agriculture", 4, ["Chemistry", "Environmental Systems"]),
    ("Crop Production", "Growing food and fiber crops", "Agriculture", 5, ["Plant Biology", "Soil Science"]),
    ("Animal Husbandry", "Livestock management", "Agriculture", 5, ["Ecology", "Genetics"]),
    ("Agricultural Economics", "Food systems and markets", "Agriculture", 6, ["Economics", "Crop Production"]),
    ("Sustainable Farming", "Environmentally friendly agriculture", "Agriculture", 6, ["Crop Production", "Environmental Science"]),
    
    # ----- Astronomy -----
    ("Solar System", "Planets, moons, and the sun", "Astronomy", 4, ["Physics"]),
    ("Stars and Galaxies", "Stellar evolution and structure", "Astronomy", 5, ["Solar System", "Chemistry"]),
    ("Cosmology", "Origin and evolution of universe", "Astronomy", 7, ["Stars and Galaxies", "Quantum Mechanics"]),
    ("Observational Astronomy", "Telescopes and data collection", "Astronomy", 5, ["Stars and Galaxies", "Waves and Optics"]),
]


async def seed_knowledge_graph() -> Dict[str, int]:
    """
    Seed the knowledge graph with concepts and prerequisites.
    Returns statistics about what was seeded.
    """
    logger.info("=" * 70)
    logger.info("Starting Knowledge Graph Seeding")
    logger.info("=" * 70)
    
    stats = {
        "concepts_created": 0,
        "prerequisites_linked": 0,
        "domains": set(),
    }
    
    # Step 1: Create all concept nodes
    for name, description, domain, difficulty, _ in CONCEPTS:
        try:
            await kg.add_concept(
                name=name,
                description=description,
                domain=domain,
                difficulty=difficulty,
            )
            stats["concepts_created"] += 1
            stats["domains"].add(domain)
            logger.debug(f"✓ Created concept: {name}")
        except Exception as exc:
            logger.error(f"✗ Failed to create concept {name}: {exc}")
    
    # Step 2: Create prerequisite relationships
    for name, _, _, _, prerequisites in CONCEPTS:
        for prereq in prerequisites:
            try:
                await kg.link_prerequisite(concept=name, prerequisite=prereq)
                stats["prerequisites_linked"] += 1
                logger.debug(f"✓ Linked: {prereq} → {name}")
            except Exception as exc:
                logger.error(f"✗ Failed to link {prereq} → {name}: {exc}")
    
    stats["domains"] = list(stats["domains"])
    
    logger.info("=" * 70)
    logger.info("Seeding Complete")
    logger.info(f"  Concepts created: {stats['concepts_created']}")
    logger.info(f"  Prerequisites linked: {stats['prerequisites_linked']}")
    logger.info(f"  Domains: {', '.join(stats['domains'])}")
    logger.info("=" * 70)
    
    return stats


async def get_concept_list_by_domain(domain: str = None) -> List[Dict[str, str]]:
    """Get a structured list of concepts, optionally filtered by domain."""
    filtered = CONCEPTS
    if domain:
        filtered = [c for c in CONCEPTS if c[2] == domain]
    
    return [
        {
            "name": name,
            "description": desc,
            "domain": dom,
            "difficulty": diff,
            "prerequisites": prereqs,
        }
        for name, desc, dom, diff, prereqs in filtered
    ]


async def simulate_user_learning_journey(
    user_id: str,
    target_concept: str,
    simulate_struggles: bool = True
) -> Dict[str, any]:
    """
    Simulate a learning journey for demo purposes.
    Shows mastery progression from prerequisites to target concept.
    """
    logger.info(f"Simulating learning journey for user {user_id} → {target_concept}")
    
    # Get the prerequisite path
    path = await kg.get_recommended_path(user_id, target_concept)
    
    journey = {
        "user_id": user_id,
        "target": target_concept,
        "path": path,
        "steps": [],
    }
    
    # Simulate learning each concept in the path
    import random
    for i, concept in enumerate(path):
        # Simulate initial struggle (lower mastery)
        initial_mastery = 0.2 + (random.random() * 0.3)  # 0.2-0.5
        
        # Simulate improvement through attempts
        attempts = random.randint(2, 5) if simulate_struggles else 2
        final_mastery = min(0.95, initial_mastery + (0.1 * attempts) + random.random() * 0.2)
        
        # Record mastery
        await kg.record_mastery(user_id, concept, final_mastery)
        
        journey["steps"].append({
            "concept": concept,
            "initial_mastery": round(initial_mastery, 2),
            "final_mastery": round(final_mastery, 2),
            "attempts": attempts,
            "improvement": round(final_mastery - initial_mastery, 2),
        })
    
    logger.info(f"Journey simulated with {len(journey['steps'])} steps")
    return journey
