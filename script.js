// Global data stores
let cardDeck = {}; // Stores the entire JSON structure, used to maintain progress status
let currentPlaylist = []; // Array of question objects currently selected for study
let currentIndex = 0; // Index of the current card in currentPlaylist

// DOM Elements
const uploadInput = document.getElementById('json-file');
const uploadStatus = document.getElementById('upload-status');
const chapterTreeDiv = document.getElementById('chapter-tree');
const shuffleBtn = document.getElementById('shuffle-playlist-btn');

const flashcardDiv = document.getElementById('flashcard');
const cardQuestion = document.getElementById('card-question');
const cardAnswer = document.getElementById('card-answer');
const cardOriginElements = document.querySelectorAll('.card-origin');

const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const correctBtn = document.getElementById('correct-btn');
const wrongBtn = document.getElementById('wrong-btn');

const summaryChapters = document.getElementById('summary-chapters');
const summaryQuestions = document.getElementById('summary-questions');
const navigatorTilesDiv = document.getElementById('navigator-tiles');
const currentIndexDisplay = document.getElementById('current-index-display');
const totalQuestionsDisplay = document.getElementById('total-questions-display');

// --- Core Utility Functions ---

/**
 * Shuffles an array in place (Fisher-Yates algorithm).
 * @param {Array} a - Array to shuffle.
 */
function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
}

/**
 * Enables or disables all main navigation/grading controls.
 * @param {boolean} enable
 */
function toggleControls(enable) {
    const controls = [prevBtn, nextBtn, correctBtn, wrongBtn];
    controls.forEach(btn => btn.disabled = !enable);
    if (enable) {
        flashcardDiv.classList.remove('flashcard-disabled');
        // Ensure initial button state is correct
        updateNavigationButtons();
    } else {
        flashcardDiv.classList.add('flashcard-disabled');
    }
}

// --- Data Loading and Parsing ---

uploadInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) {
        uploadStatus.textContent = 'No file selected.';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            parseAndStoreDeck(data);
            uploadStatus.textContent = `File loaded successfully: ${Object.keys(cardDeck).length} subjects found.`;
            generateChapterTree();
            // Controls remain disabled until a chapter is selected
        } catch (error) {
            console.error("Error parsing JSON:", error);
            uploadStatus.textContent = 'Error: Invalid JSON file format.';
            cardDeck = {};
            currentPlaylist = [];
            chapterTreeDiv.innerHTML = '';
            toggleControls(false);
            shuffleBtn.disabled = true;
        }
    };
    reader.onerror = () => {
        uploadStatus.textContent = 'Error reading file.';
        cardDeck = {};
        toggleControls(false);
        shuffleBtn.disabled = true;
    };
    reader.readAsText(file);
});

/**
 * Parses the raw JSON data, adds 'status' and 'origin' properties.
 * @param {Object} rawData - The raw data from the JSON file.
 */
function parseAndStoreDeck(rawData) {
    cardDeck = {}; // Reset the deck
    for (const subjectName in rawData) {
        cardDeck[subjectName] = {};
        for (const chapterName in rawData[subjectName]) {
            // Map the raw question array to a new array with status and origin
            cardDeck[subjectName][chapterName] = rawData[subjectName][chapterName].map(q => ({
                q: q.q,
                a: q.a,
                status: 'unseen', // Mandatory dynamic property
                origin: `${subjectName} - ${chapterName}`
            }));
        }
    }
}

// --- Sidebar/Hierarchy Management ---

/**
 * Generates the collapsible subject/chapter hierarchy in the sidebar.
 */
function generateChapterTree() {
    chapterTreeDiv.innerHTML = ''; // Clear previous content

    for (const subject in cardDeck) {
        const subjectEl = document.createElement('div');
        subjectEl.classList.add('subject');

        const headerEl = document.createElement('div');
        headerEl.classList.add('subject-header');
        headerEl.textContent = '▶ ' + subject; // Collapsible icon
        headerEl.addEventListener('click', () => {
            const list = headerEl.nextElementSibling;
            const isHidden = list.style.display === 'none';
            list.style.display = isHidden ? 'block' : 'none';
            headerEl.textContent = isHidden ? '▼ ' + subject : '▶ ' + subject;
        });

        const chapterListEl = document.createElement('ul');
        chapterListEl.classList.add('chapter-list');
        chapterListEl.style.display = 'none'; // Initially collapsed

        for (const chapter in cardDeck[subject]) {
            const item = document.createElement('li');
            item.classList.add('chapter-item');
            item.dataset.subject = subject;
            item.dataset.chapter = chapter;

            const checkboxId = `${subject}-${chapter}`.replace(/[^a-zA-Z0-9-]/g, '');

            item.innerHTML = `
                <input type="checkbox" id="${checkboxId}">
                <label for="${checkboxId}">${chapter}</label>
                <span id="progress-${checkboxId}" class="progress-counter">(${getChapterProgress(subject, chapter)})</span>
            `;

            chapterListEl.appendChild(item);
        }

        subjectEl.appendChild(headerEl);
        subjectEl.appendChild(chapterListEl);
        chapterTreeDiv.appendChild(subjectEl);
    }
    
    // Add event listener to the parent to capture all checkbox changes
    chapterTreeDiv.addEventListener('change', handleChapterToggle);
}

/**
 * Calculates and returns the progress string (e.g., "3/10") for a given chapter.
 * @param {string} subject - The subject name.
 * @param {string} chapter - The chapter name.
 * @returns {string} The progress string.
 */
function getChapterProgress(subject, chapter) {
    const questions = cardDeck[subject][chapter];
    if (!questions) return '0/0';
    const gradedCount = questions.filter(q => q.status !== 'unseen').length;
    return `${gradedCount}/${questions.length}`;
}

/**
 * Handles the toggling of a chapter checkbox.
 */
function handleChapterToggle(event) {
    if (event.target.type !== 'checkbox') return;

    // Rebuild the currentPlaylist
    currentPlaylist = [];
    let selectedChapters = 0;

    // Iterate through all chapters in the deck
    for (const subject in cardDeck) {
        for (const chapter in cardDeck[subject]) {
            const checkboxId = `${subject}-${chapter}`.replace(/[^a-zA-Z0-9-]/g, '');
            const checkbox = document.getElementById(checkboxId);

            if (checkbox && checkbox.checked) {
                // Add a reference (all questions) from the original deck
                currentPlaylist.push(...cardDeck[subject][chapter]);
                selectedChapters++;
            }
        }
    }

    // Update Summary and Controls
    summaryChapters.textContent = selectedChapters;
    summaryQuestions.textContent = currentPlaylist.length;

    if (currentPlaylist.length > 0) {
        shuffleBtn.disabled = false;
        // Automatically start the study session if a chapter is newly added
        // if no cards were previously selected, otherwise the user can shuffle later.
        if (currentIndex === 0 && selectedChapters === 1) {
             startStudySession();
        } else if (currentPlaylist.length > 0) {
            // Just update the navigator if not shuffling
            renderQuestionNavigator();
            updateCardDisplay();
            // Re-check controls as a chapter was added/removed
            toggleControls(true);
        }
    } else {
        // Reset state if playlist is empty
        shuffleBtn.disabled = true;
        toggleControls(false);
        resetCardDisplay();
        renderQuestionNavigator();
    }
}

/**
 * Updates the progress counter display for a specific chapter in the sidebar.
 * @param {string} subject
 * @param {string} chapter
 */
function updateSidebarProgress(subject, chapter) {
    const checkboxId = `${subject}-${chapter}`.replace(/[^a-zA-Z0-9-]/g, '');
    const progressSpan = document.getElementById(`progress-${checkboxId}`);
    if (progressSpan) {
        progressSpan.textContent = `(${getChapterProgress(subject, chapter)})`;
    }
}

// --- Flashcard and Navigation Logic ---

/**
 * Initializes/resets the study session by shuffling the playlist and setting the index.
 */
function startStudySession() {
    if (currentPlaylist.length === 0) return;

    shuffleArray(currentPlaylist);
    currentIndex = 0;
    updateCardDisplay();
    renderQuestionNavigator();
    toggleControls(true);
    // Ensure card is flipped to the front
    flashcardDiv.classList.remove('flipped');
}

shuffleBtn.addEventListener('click', startStudySession);

/**
 * Updates the flashcard content based on the current card.
 */
function updateCardDisplay() {
    if (currentPlaylist.length === 0) {
        resetCardDisplay();
        return;
    }

    const card = currentPlaylist[currentIndex];

    // Card Content
    cardQuestion.textContent = card.q;
    cardAnswer.textContent = card.a;

    cardOriginElements.forEach(el => el.textContent = card.origin);

    // Card Status Styling (for visual indication on the flashcard itself, optional)
    flashcardDiv.classList.remove('status-correct', 'status-wrong', 'status-unseen');
    flashcardDiv.classList.add(`status-${card.status}`);

    // Navigator and Button Status
    updateNavigationButtons();
    updateNavigatorTilesActive();

    currentIndexDisplay.textContent = currentIndex + 1;
    totalQuestionsDisplay.textContent = currentPlaylist.length;
}

/**
 * Resets the card display to the initial state.
 */
function resetCardDisplay() {
    cardQuestion.textContent = 'Upload a JSON file and select chapters to begin.';
    cardAnswer.textContent = '';
    cardOriginElements.forEach(el => el.textContent = '');
    flashcardDiv.classList.remove('flipped');
    currentIndexDisplay.textContent = 0;
    totalQuestionsDisplay.textContent = 0;
}

/**
 * Enables/disables Previous/Next buttons based on currentIndex.
 */
function updateNavigationButtons() {
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === currentPlaylist.length - 1;
}

// Navigation Handlers
prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
        currentIndex--;
        flashcardDiv.classList.remove('flipped'); // Flip back to question
        updateCardDisplay();
    }
});

nextBtn.addEventListener('click', () => {
    if (currentIndex < currentPlaylist.length - 1) {
        currentIndex++;
        flashcardDiv.classList.remove('flipped'); // Flip back to question
        updateCardDisplay();
    }
});

// Flashcard Flip
flashcardDiv.addEventListener('click', () => {
    if (currentPlaylist.length > 0) {
        flashcardDiv.classList.toggle('flipped');
    }
});

// --- Grading Logic ---

/**
 * Handles grading (Correct/Wrong) and advances to the next card.
 * @param {string} status - The new status ('correct' or 'wrong').
 */
function gradeCardAndAdvance(status) {
    if (currentPlaylist.length === 0) return;

    const currentCard = currentPlaylist[currentIndex];

    // 1. Update the card's status in the current playlist
    currentCard.status = status;
    
    // 2. Reflect the change in the sidebar progress counter
    // The origin field is formatted as "Subject - Chapter"
    const [subject, chapter] = currentCard.origin.split(' - ', 2);
    updateSidebarProgress(subject, chapter);

    // 3. Update the visual navigator tile status
    updateNavigatorTileStatus(currentIndex, status);

    // 4. Automatically advance to the next card
    if (currentIndex < currentPlaylist.length - 1) {
        currentIndex++;
        flashcardDiv.classList.remove('flipped'); // Flip back to question
        updateCardDisplay();
    } else {
        // Handle end of playlist (e.g., stay on the last card, or show summary)
        updateCardDisplay(); // Update display for the last card's status change
        alert('You have reached the end of the current study playlist!');
        // Keep controls enabled, user can navigate back
    }
}

correctBtn.addEventListener('click', () => gradeCardAndAdvance('correct'));
wrongBtn.addEventListener('click', () => gradeCardAndAdvance('wrong'));


// --- Question Navigator Logic ---

/**
 * Renders the visual tiles for all questions in the current playlist.
 */
function renderQuestionNavigator() {
    navigatorTilesDiv.innerHTML = '';
    if (currentPlaylist.length === 0) {
        navigatorTilesDiv.textContent = 'Select a chapter to populate the playlist.';
        return;
    }
    
    navigatorTilesDiv.textContent = ''; // Clear status message
    currentPlaylist.forEach((card, index) => {
        const tile = document.createElement('div');
        tile.classList.add('nav-tile', `status-${card.status}`);
        tile.dataset.index = index;
        tile.title = `Card ${index + 1}`;
        
        tile.addEventListener('click', () => {
            currentIndex = index;
            flashcardDiv.classList.remove('flipped'); // Flip back to question when jumping
            updateCardDisplay();
        });
        
        navigatorTilesDiv.appendChild(tile);
    });
    updateNavigatorTilesActive();
}

/**
 * Updates the active tile border and overall status for all tiles.
 */
function updateNavigatorTilesActive() {
    const tiles = navigatorTilesDiv.querySelectorAll('.nav-tile');
    tiles.forEach((tile, index) => {
        tile.classList.remove('active');
        if (index === currentIndex) {
            tile.classList.add('active');
        }
    });
}

/**
 * Updates a single tile's status class.
 * @param {number} index - Index of the tile to update.
 * @param {string} status - The new status ('correct', 'wrong', 'unseen').
 */
function updateNavigatorTileStatus(index, status) {
    const tile = navigatorTilesDiv.querySelector(`.nav-tile[data-index="${index}"]`);
    if (tile) {
        tile.classList.remove('status-unseen', 'status-correct', 'status-wrong');
        tile.classList.add(`status-${status}`);
    }
}

// Initial state setup (ensure controls are disabled on load)
toggleControls(false);
shuffleBtn.disabled = true;
renderQuestionNavigator(); // Display initial message