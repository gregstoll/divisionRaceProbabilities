// TODO
// - margins, especially for editable
// - centering for editable
// - pie chart? (this won't work with > 1)
function accumulateSimulationResults(results, wins) {
    // Array.toSorted() isn't quite widely supported enough yet...
    let sortedWins = [...wins];
    sortedWins.sort((a,b) => b - a);
    // Ties are annoying.
    // We will handle this by saying if there are N teams
    // tied for second place, each team will get 1/N of a
    // win for second place through (2+N-1)th place.
    let lastValue = sortedWins[0] + 1;
    let winsIndex = 0;
    let currentPosition = 0;
    while (winsIndex < sortedWins.length) {
        let lastWinsIndex = winsIndex;
        while (sortedWins[winsIndex] === lastValue && winsIndex < sortedWins.length)  {
            winsIndex++;
        }
        let numberOfTies = winsIndex - lastWinsIndex;
        for (let k = 0; k < sortedWins.length; k++) {
            if (wins[k] === sortedWins[winsIndex - 1]) {
                for (let m = 0; m < numberOfTies; m++) {
                    results[k][currentPosition+m] += 1.0 / numberOfTies;
                }
            }
        }
        currentPosition += numberOfTies;
        if (winsIndex < sortedWins.length) {
            lastValue = sortedWins[winsIndex];
        }
    }
}
function simulateDivision(gamesBackArray, gamesLeft, iterations) {
    if (gamesBackArray.length === 0) {
        return [];
    }
    let results = Array.from(gamesBackArray.map(_ => new Array(gamesBackArray.length).fill(0)));
    // This whole thing is really inefficient, but
    // modern computers are fast so I'm going to live
    // with it for now.
    for (let i = 0; i < iterations; i++) {
        let wins = gamesBackArray.map(x => -1 * x);
        for (let g = 0; g < gamesLeft; g++) {
            for (let j = 0; j < wins.length; j++) {
                wins[j] += Math.floor(Math.random() * 2);
            }
        }
        accumulateSimulationResults(results, wins);
    }
    return results;
}
class TeamGamesBack extends HTMLElement {
    // Would be nice to use class static initialization
    // blocks but they're not quite widely supported enough
    // for me.
    static readOnlyTemplate = document.createElement("template");
    static editableTemplate = document.createElement("template");
    constructor() {
        super();
        this._simulationsUpToDate = true;
        this.attachShadow({ mode: 'open' });
    }
    static get observedAttributes() {
        return ['qualify-percentage', 'simulations-up-to-date', 'team-name', 'games-back'];
    }
    attributeChangedCallback(_name, _oldValue, _newValue) {
        this.render();
    }

    connectedCallback() {
        let outOfDateStyle = "";
        if (!this.readonly) {
            outOfDateStyle = "div.outOfDate { color: grey; }";
        }
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="output.css">
            <style>
                ${outOfDateStyle}
            </style>
            <div id="mainGrid" class="grid grid-cols-4">
            </div>
        `;
        // Assumes that this.readonly doesn't change
        this.shadowRoot.getElementById("mainGrid").appendChild(
            (this.readonly ? TeamGamesBack.readOnlyTemplate : TeamGamesBack.editableTemplate)
             .content.cloneNode(true));

        this.setupEventListeners();
        this.isInitialized = true;
        this.render();
    }
    setupEventListeners() {
        if (!this.readonly) {
            this.shadowRoot.querySelector('input.teamName').addEventListener('change', (e) => {
                this.teamName = e.target.value;
            });
            this.shadowRoot.querySelector('input.gamesBack').addEventListener('change', (e) => {
                this.gamesBack = e.target.value;
            });
            this.shadowRoot.querySelector('.delete-btn').addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent("team-changed", {
                    bubbles: true,
                    composed: true
                }));
                this.remove();
            });
        }
    }
    get readonly() {
        return this.getAttribute('readonly') === "true";
    }
    get gamesBack() {
        return parseInt(this.getAttribute('games-back'), 10);
    }
    get highlight() {
        return this.hasAttribute("highlight");
    }
    set gamesBack(value) {
        if (value.toString() !== this.gamesBack) {
            this.setAttribute('games-back', value);
            this.shadowRoot.dispatchEvent(new CustomEvent("team-changed", {
                bubbles: true,
                composed: true
            }));
        }
    }
    get teamName() {
        return this.getAttribute('team-name').trim();
    }
    set teamName(value) {
        this.setAttribute('team-name', value.trim());
    }
    set qualifyPercentage(value) {
        this.setAttribute('qualify-percentage', value);
    }
    get qualifyPercentage() {
        return this.getAttribute('qualify-percentage');
    }
    get simulationsUpToDate() {
        return this.getAttribute("simulations-up-to-date") === "true";
    }
    set simulationsUpToDate(value) {
        this.setAttribute("simulations-up-to-date", value);
    }

    setDivOrInputValue(element, value) {
        if (element.tagName.toLowerCase() === "input") {
            element.value = value;
        } else {
            element.innerHTML = value;
        }
    }
    render() {
        // Can get this callback early if some attributes are changed
        if (!this.isInitialized) {
            return;
        }
        let winPercentageText = "";
        if (this.qualifyPercentage !== null) {
            winPercentageText = (Math.round(Number.parseFloat(this.qualifyPercentage) * 1000) / 10).toFixed(1) + "%";
        }
        this.shadowRoot.getElementById("teamName").classList.toggle("font-bold", this.highlight);
        this.shadowRoot.getElementById("gamesBack").classList.toggle("font-bold", this.highlight);
        this.shadowRoot.getElementById("winPercentage").classList.toggle("font-bold", this.highlight);
        this.shadowRoot.getElementById("winPercentage").classList.toggle("outOfDate", !this.simulationsUpToDate);
        this.setDivOrInputValue(this.shadowRoot.getElementById("teamName"), this.teamName);
        this.setDivOrInputValue(this.shadowRoot.getElementById("gamesBack"), this.gamesBack);
        this.setDivOrInputValue(this.shadowRoot.getElementById("winPercentage"), winPercentageText);
    }
}

TeamGamesBack.readOnlyTemplate.innerHTML = `
            <div id="teamName"></div>
            <div id="gamesBack" class="text-right"></div>
            <div id="winPercentage" class="text-right"></div>
            <div></div>`

// Don't allow half-games - it doesn't make sense if every team
// has the same number of games left to play.
TeamGamesBack.editableTemplate.innerHTML = `
            <input id="teamName" type="text" class="teamName" class="border rounded px-2 py-1">
            <input id="gamesBack" type="number" class="gamesBack" min="0" class="border rounded px-2 py-1">
            <div id="winPercentage" class="text-right"></div>
            <button class="delete-btn bg-red-500 text-white px-2 py-1 rounded">Delete</button>
            `;

customElements.define('team-games-back', TeamGamesBack);

class Division extends HTMLElement {
    constructor() {
        super();
        this._simulationsUpToDate = true;
        this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
        this.render();
        this.setupEventListeners();
        this.processInitialChildren();
    }
    makeFakeName(index) {
        switch (index) {
            case 0:
                return "Astros";
            case 1:
                return "Blue Jays";
            case 2:
                return "Cubs";
            case 3:
                return "Dodgers";
            case 4:
                return "Eagles";
            case 5:
                return "Falcons";
            case 6:
                return "Giants";
            case 7:
                return "Heat";
            case 8:
                return "Islanders";
            case 9:
                return "Jazz";
        }
        return `Team ${index + 1}`;
    }
    setupEventListeners() {
        this.shadowRoot.getElementById('addItem')?.addEventListener('click', () => this.addItem());
        this.shadowRoot.getElementById('numberOfWinningTeams')?.addEventListener('change', (e) => {
            this.numberOfWinningTeams = parseInt(e.target.value, 10);
        });
        this.shadowRoot.getElementById('simulate').addEventListener('click', () => {
            const items = this.childTeamGamesBack;
            const gamesBackArray = Array.from(items).map(item => item.gamesBack);
            const GAMES = 80;
            const NUM_ITERATIONS = 5000;
            let results = simulateDivision(gamesBackArray, GAMES, NUM_ITERATIONS);
            this.simulationsUpToDate = true;
            items.forEach((item, index) => {
                item.qualifyPercentage = results[index].slice(0, this.numberOfWinningTeams).reduce((sum, v) => sum + v) / NUM_ITERATIONS;
            });
        });
        this.shadowRoot.addEventListener("team-changed", e => {
            this.simulationsUpToDate = false;
        });
    }
    get childTeamGamesBack() {
        return Array.from(this.shadowRoot.querySelectorAll('team-games-back'));
    }
    processInitialChildren() {
        const itemList = this.shadowRoot.getElementById('itemList');
        let childrenArray = Array.from(this.children)
            .filter(child => child.tagName.toLowerCase() === 'team-games-back');
        const isEmpty = childrenArray.length === 0;
        childrenArray.forEach(child => {
            child.setAttribute('readonly', this.readonly);
            let newDiv = document.createElement("div");
            newDiv.classList.add("col-start-1", "col-end-5");
            newDiv.appendChild(child);
            itemList.appendChild(newDiv);
        });
        if (isEmpty) {
            this.addItem();
        }
    }
    get numberOfWinningTeams() {
        const winningTeams = parseInt(this.getAttribute('winningTeams'), 10);
        return (winningTeams && !isNaN(winningTeams)) ? winningTeams : 1;
    }
    set numberOfWinningTeams(value) {
        if (this.numberOfWinningTeams !== value) {
            this.setAttribute('winningTeams', value.toString());
            this.simulationsUpToDate = false;
            // This might change the header text
            // TODO - just call render?
            this.setWinOrAdvanceText();
        }
    }
    get readonly() {
        return this.getAttribute('readonly') === "true";
    }
    // TODO - use templates or whatever?
    render() {
        const addItemHtml = `<div class="mb-4">
                <button id="addItem" class="bg-blue-500 text-white px-4 py-1 rounded">Add New Item</button>
            </div>`;
        const numberOfWinningTeamsReadonlyHtml = `Top ${this.numberOfWinningTeams} teams advance`;
        const numberOfWinningTeamsEditableHtml = `Top <input type="number" value="${this.numberOfWinningTeams}" min="1" max="10" style="width: 35px;" id="numberOfWinningTeams"> teams advance`;
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="output.css">
            <div class="mb-4 mt-4 border-solid border-2 border-neutral-600 rounded-lg p-4">
            ${!this.readonly ? addItemHtml : ""}
            <div class="mt-2">${this.readonly ? 
                    ((this.numberOfWinningTeams > 1) ? numberOfWinningTeamsReadonlyHtml : "")
                    : numberOfWinningTeamsEditableHtml}</div>
            <div class="grid grid-cols-4" id="itemList">
                <div class="font-semibold">Team</div><div class="font-semibold text-right">Games back</div><div class="font-semibold text-right"><span id="winOrAdvanceText"></span> %</div><div></div>
            </div>
            <button id="simulate" class="bg-green-500 text-white px-4 py-2 rounded">Simulate Division</button>
            </div>
        `;
        this.setWinOrAdvanceText();
    }
    setWinOrAdvanceText() {
        const text = (this.numberOfWinningTeams === 1) ? "Win" : "Advance";
        this.shadowRoot.getElementById("winOrAdvanceText").innerText = text;
    }
    get simulationsUpToDate() {
        return this._simulationsUpToDate;
    }
    set simulationsUpToDate(value) {
        if (this._simulationsUpToDate !== value) {
            this._simulationsUpToDate = value;
            for (const child of this.childTeamGamesBack) {
                child.simulationsUpToDate = value;
            }
        }
    }
    addItem() {
        this.simulationsUpToDate = false;
        const team = document.createElement('team-games-back');
        team.setAttribute('games-back', '0');
        team.setAttribute('readonly', this.readonly);
        const existingItems = this.shadowRoot.querySelectorAll('team-games-back');
        let existingNames = new Set();
        existingItems.forEach(elem => existingNames.add(elem.teamName));
        let index = existingItems.length;
        let name;
        do {
            name = this.makeFakeName(index);
            index++;
        } while (existingNames.has(name));
        team.setAttribute('team-name', name);
        let newDiv = document.createElement("div");
        newDiv.classList.add("col-start-1", "col-end-5");
        newDiv.appendChild(team);
        this.shadowRoot.getElementById('itemList').appendChild(newDiv);
    }
}

customElements.define('division-element', Division);

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("runTests").addEventListener('click', () => {
        function assert(expected, actual, description) {
            if (expected - actual >= 0.01) {
                throw `${description} - expected ${expected}, actual ${actual}`;
            }
        }
        function assertResults(expected, actual, description) {
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    assert(expected[i][j], actual[i][j], `${description} element[${i}][${j}]`);
                }
            }
        }
        function runTest(wins, expectedResults) {
            let results = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
            accumulateSimulationResults(results, wins);
            assertResults(expectedResults, results, `${wins}`);
        }
        document.getElementById("testResults").innerHTML = "";
        try {
            runTest([4, 6, 5], [[0, 0, 1], [1, 0, 0], [0, 1, 0]]);
            runTest([4, 4, 5], [[0, 0.5, 0.5], [0, 0.5, 0.5], [1, 0, 0]]);
            runTest([5, 4, 5], [[0.5, 0.5, 0], [0, 0, 1], [0.5, 0.5, 0]]);
            runTest([5, 5, 5], [[0.333, 0.333, 0.333], [0.333, 0.333, 0.333], [0.333, 0.333, 0.333]]);
        }
        catch (failure) {
            let div = document.createElement("div");
            div.classList.add("bg-red-500");
            div.classList.add("text-white");
            div.appendChild(document.createTextNode(`Tests failed: ${failure}`));
            document.getElementById('testResults').appendChild(div);

        }
        if (document.getElementById('testResults').children.length === 0) {
            let div = document.createElement("div");
            div.classList.add("bg-green-500");
            div.classList.add("text-white");
            div.appendChild(document.createTextNode("Tests passed!"));
            document.getElementById('testResults').appendChild(div);
        }
    });
});
