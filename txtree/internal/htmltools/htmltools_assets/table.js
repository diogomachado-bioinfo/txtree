function searchTable() {
    // Show the overlay indicating the search process has started
    showBlockingOverlay('Searching... Please wait.');

    setTimeout(function() {
        try {
            // Get the search query and table elements
            const query = document.getElementById("search-input").value.trim();
            const table = document.getElementById("dataTable");
            const rows = table.querySelectorAll("tbody tr");
            const nRows = rows[0].children.length;

            // Get the number of neighbors to include (k)
            const k = parseInt(document.getElementById("neighbors-number-input").value) || 0;

            let filteredRows = 0;

            // Reset all rows to their default state before applying filters
            rows.forEach(row => {
                row.style.display = ""; // Make all rows visible
                if (row.hasAttribute('data-original-text')) {
                    row.innerHTML = row.getAttribute('data-original-text'); // Restore original row content
                }
            });

            // Exit early if the search query is empty
            if (!query) {
                let totalEntriesElement = document.getElementById('totalEntries');
                let totalRows = totalEntriesElement.getAttribute('data-total-rows');
                document.getElementById('filtered-entries').innerText = 'Selected entries: ' + totalRows;
                hideBlockingOverlay();
                return;
            }

            // Parse the search query into terms and indices
            let queryParsed = parseSearchQuery(query);

            // Initialize an array to store match results for each term
            let matchResults = [];
            for (let j = 0; j < queryParsed.terms.length; j++) {
                matchResults.push([]); // Add a sublist for each term
            }

            // Iterate through each row to find matches
            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].querySelectorAll('td');
                for (let j = 0; j < queryParsed.terms.length; j++) {
                    let regex;
                    try {
                        regex = new RegExp('(' + queryParsed.terms[j] + ')', 'gi'); // Create regex for the term
                    } catch (e) {
                        regex = null; // Handle invalid regex
                    }
                    try {
                        let match = false;
                        if (queryParsed.indices[j] === null) {
                            // Check all columns if no specific index is provided
                            for (let i = 0; i < cells.length; i++) {
                                if (regex && regex.test(cells[i].textContent)) {
                                    match = true;
                                    break;
                                }
                            }
                        } else {
                            // Check a specific column based on the index
                            match = regex && regex.test(cells[queryParsed.indices[j]].textContent);
                        }
                        matchResults[j].push(match); // Store the match result
                    } catch (e) {
                        matchResults[j].push(false); // Handle errors gracefully
                    }
                }
            }

            // Combine match results using logical operations
            let result = evaluateLogicalExpression(matchResults, queryParsed.indiceQuery);

            // Expand results to include k neighbors on both sides
            let expandedResult = new Array(rows.length).fill(false);
            for (let i = 0; i < result.length; i++) {
                if (result[i]) {
                    for (let j = Math.max(0, i - k); j <= Math.min(rows.length - 1, i + k); j++) {
                        expandedResult[j] = true; // Mark neighbors for display
                    }
                }
            }

            // Apply filtering and highlighting to the rows
            for (let i = 0; i < expandedResult.length; i++) {
                let rowSel = rows[i];
                if (expandedResult[i]) {
                    // Save the original content of the row if not already saved
                    if (!rowSel.getAttribute('data-original-text')) {
                        let rowContent = rowSel.innerHTML;
                        rowSel.setAttribute('data-original-text', rowContent);
                    }

                    let rowCells = rowSel.getElementsByTagName('td');
                    rowSel.style.display = ''; // Make the row visible
                    filteredRows++;

                    // Highlight matching text in the row's cells
                    for (let k = 0; k < queryParsed.terms.length; k++) {
                        let input = queryParsed.terms[k];
                        let regex = new RegExp('(' + input + ')', 'gi');
                        if (queryParsed.indices[k] === null) {
                            for (let cell of rowCells) {
                                highlightCellContent(cell, regex); // Highlight all cells
                            }
                        } else {
                            let cell = rowCells[queryParsed.indices[k]];
                            highlightCellContent(cell, regex); // Highlight specific cell
                        }
                    }
                } else {
                    rowSel.style.display = 'none'; // Hide the row
                }
            }

            // Update the count of filtered entries
            document.getElementById('filtered-entries').innerText = 'Selected entries: ' + filteredRows;
        } catch (e) {
            console.log(e); // Log any errors
            alert("The search string provided is invalid."); // Notify the user of invalid input
        }

        // Hide the overlay after the search process completes
        hideBlockingOverlay();
    }, 50); // Delay execution to ensure overlay visibility
}

// Function to apply highlighting to a given cell
function highlightCellContent(cell, regex) {
    let cellContent = cell.innerHTML;

    // Split content to separate HTML tags and text
    let parts = cellContent.split(/(<[^>]+>)/).filter(Boolean);
    let highlightContent = '';

    for (let part of parts) {
        if (/<[^>]+>/.test(part)) {
            // Keep HTML tags as is
            highlightContent += part;
        } else {
            // Highlight the matching text
            highlightContent += part.replace(regex, '<span class="highlight">$1</span>');
        }
    }

    // Update the cell content
    cell.innerHTML = highlightContent;
}

function escapeRegExp(str) {
    // Escape special characters in the string for use in a regular expression
    return str.replace(/[.*+?^=!:${}()|\[\]\/\\]/g, '\\$&');
}

function parseSearchQuery(query) {
    // Define logical operators
    const operators = ['AND', 'OR'];
    const operatorPattern = new RegExp(`\\b(${operators.join('|')})\\b`, 'g');

    // Regular expression to capture terms and indices within brackets
    const indexPattern = /\[(\d+)\]$/g; // Matches indices

    // Arrays to store terms e índices
    let terms = [];
    let indices = [];

    // Split the query string by logical operators
    let segments = query.split(operatorPattern)
        .map(segment => segment.trim()) // Remove espaços em branco
        .filter(segment => !operators.includes(segment)); // Remove os operadores

    // Extract terms and indices
    segments.forEach(segment => {
        // Remove leading parentheses from the term only
        const term = segment.replace(indexPattern, '').trim().replace(/^\(?(.*?)\)?$/, '$1');
        terms.push(term);

        // Extract indices
        let indexMatches;
        while ((indexMatches = indexPattern.exec(segment))) {
            indices.push(parseInt(indexMatches[1], 10));
        }

        // Add null for missing indices corresponding to terms
        while (indices.length < terms.length) {
            indices.push(null);
        }
    });

    // Replace terms with their indices in the original string
    let indiceQuery = query;
    terms.forEach((term, index) => {
        const regexTerm = new RegExp(
            `${escapeRegExp(term)}(?:\\[${indices[index] !== null ? indices[index] : ''}\\])?`,
            'g'
        );
        indiceQuery = indiceQuery.replace(regexTerm, index);
    });

    // Return the results
    return {
        terms,
        indices,
        indiceQuery
    };
}

function evaluateLogicalExpression(logicalLists, expression) {
    // Function to perform AND operation between two boolean lists
    function andOperation(list1, list2) {
        return list1.map((val, idx) => val && list2[idx]);
    }

    // Function to perform OR operation between two boolean lists
    function orOperation(list1, list2) {
        return list1.map((val, idx) => val || list2[idx]);
    }

    // Function to resolve the logical expression considering parentheses and operators
    function resolveExpression(expression) {
        // Regular expression to find index references and operators
        const regex = /(\d+|\(|\)|AND|OR)/g;

        // Split the expression into tokens
        const tokens = expression.match(regex);

        // Stack to store partial results
        let stack = [];

        tokens.forEach(token => {
            if (token === "AND" || token === "OR") {
                // If it's an operator, push it to the stack to apply later
                stack.push(token);
            } else if (token === "(") {
                // If it's an opening parenthesis, push it to the stack
                stack.push(token);
            } else if (token === ")") {
                // If it's a closing parenthesis, resolve the expression inside
                let subExpression = [];
                while (stack[stack.length - 1] !== "(") {
                    subExpression.unshift(stack.pop());
                }
                stack.pop(); // Remove the '('
                let result = evaluateSubExpression(subExpression);
                stack.push(result);
            } else {
                // If it's an index, get the corresponding list
                let index = parseInt(token);
                stack.push(logicalLists[index]);
            }
        });

        // Resolve the remaining expression in the stack
        return evaluateSubExpression(stack);
    }

    // Function to apply AND/OR operators in the token stack
    function evaluateSubExpression(subExpression) {
        while (subExpression.length > 1) {
            let val1 = subExpression.shift();
            let operator = subExpression.shift();
            let val2 = subExpression.shift();

            if (operator === "AND") {
                subExpression.unshift(andOperation(val1, val2));
            } else if (operator === "OR") {
                subExpression.unshift(orOperation(val1, val2));
            }
        }
        return subExpression[0];
    }

    // Resolve the provided expression
    return resolveExpression(expression);
}

function expandSearchQuery(parsedQuery, totalColumns) {
    const expandedTerms = [];
    const expandedIndices = [];
    let expandedIndiceQuery = parsedQuery.indiceQuery;

    parsedQuery.terms.forEach((term, index) => {
        const columnIndex = parsedQuery.indices[index];

        if (columnIndex === null) {
            // Replace the original index in the indiceQuery with expanded indices
            const expandedIndicesString = Array.from({ length: totalColumns }, (_, i) => expandedTerms.length + i).join(" OR ");
            expandedIndiceQuery = expandedIndiceQuery.replace(new RegExp(`\\b${index}\\b`, "g"), `(${expandedIndicesString})`);

            // Add the term for all columns
            for (let i = 0; i < totalColumns; i++) {
                expandedTerms.push(term);
                expandedIndices.push(i);
            }
        } else {
            // Keep the original term and index
            expandedTerms.push(term);
            expandedIndices.push(columnIndex);
        }
    });

    return {
        terms: expandedTerms,
        indices: expandedIndices,
        indiceQuery: expandedIndiceQuery, // Adjusted logical index query
    };
}

///////////////////////////////////////////////////////////////////////
// Triggers a button click when the "Enter" key is pressed while the search-input is focused
document.addEventListener("DOMContentLoaded", () => {
    // Listen for keydown events on the document
    document.addEventListener("keydown", (event) => {
        // Check if the pressed key is "Enter" and if the active element is the search-input
        if (event.key === "Enter" && (document.activeElement.id === "search-input" || document.activeElement.id === "neighbors-number-input")) {
            // Trigger the button's click event
            document.getElementById("search-button").click();
        }
    });
});

// Function to clear all filters
function clearAllFilters() {
    // Show the progress bar before starting the search process
    showBlockingOverlay('Cleaning... Please wait.');

    // Delay the execution slightly to ensure the overlay appears first
    setTimeout(function() {
        const table = document.getElementById("dataTable");
        const rows = table.querySelectorAll("tbody tr");
        const searchInput = document.getElementById("search-input");
		const neighborsNumberInput = document.getElementById("neighbors-number-input");

        // Restores the original content
        rows.forEach(row => {
            // Show all rows
            row.style.display = "";
            if (row.hasAttribute('data-original-text')) {
                // Restore original HTML
                row.innerHTML = row.getAttribute('data-original-text');
            }
        });

        searchInput.value = "";
		neighborsNumberInput.value = "";

        // Updates the selected entries count to show all rows
        updateTotalEntries();

        // Hide the progress bar after the cleaning is done
        hideBlockingOverlay();
    }, 50);  // Adjust delay as needed
}

// Event listener for the "Clear Filters" button
document.addEventListener('DOMContentLoaded', function() {
    const clearButton = document.getElementById('clearFiltersButton');
    if (clearButton) {
        clearButton.addEventListener('click', function() {
            clearAllFilters();
        });
    }
});

// Function to update the filtered entries count
function updateTotalEntries() {
    const table = document.getElementById('dataTable');
    const tbody = table.querySelector('tbody');
    const rows = tbody.getElementsByTagName('tr');
    const totalRows = rows.length;
	const totalEntriesElement = document.getElementById('total-entries');

    totalEntriesElement.innerText = 'Total entries: ' + totalRows;
    document.getElementById('filtered-entries').innerText = 'Selected entries: ' + totalRows;

    // Store the value in a data-total-rows attribute for later access
    totalEntriesElement.setAttribute('data-total-rows', totalRows);
}

// Updates the total number of entries when the page loads
document.addEventListener('DOMContentLoaded', function() {
    const dataTable = document.getElementById('dataTable');
    if (dataTable) {
        updateTotalEntries(); // Calls to update the total number of entries
    }
});

///////////////////////////////////////////////////////////////////////
// Function to sort the table
function sortTable(n) {
    // Show the progress bar before starting the sorting process
    showBlockingOverlay('Sorting... Please wait.');

    // Add a small delay to ensure the progress bar appears before sorting begins
    setTimeout(() => {
        let table = document.getElementById("dataTable");
        // Get tbody element
        let tbody = table.querySelector('tbody');
        // Get all rows inside tbody
        let rows = Array.from(tbody.rows);

        // Get current sorting directions for all columns, or set to 'asc' initially
        let dirs = table.dataset.sortDirs ? table.dataset.sortDirs.split(",") : [];
        // Default to ascending for the clicked column
        let dir = dirs[n] || "asc";

        // Reset the direction of all columns except the one clicked
        dirs = dirs.map((d, index) => index === n ? d : "");

        // Update the direction of the clicked column
        dirs[n] = (dir === "asc") ? "desc" : "asc";

        // Store the updated sorting directions
        table.dataset.sortDirs = dirs.join(",");

        // Create a function to compare the rows
        const compareRows = (row1, row2) => {
            let x = row1.cells[n].innerText;
            let y = row2.cells[n].innerText;

            let xVal = isNaN(x) ? x.toLowerCase() : parseFloat(x);
            let yVal = isNaN(y) ? y.toLowerCase() : parseFloat(y);

            if (dir === "asc") {
                return xVal > yVal ? 1 : (xVal < yVal ? -1 : 0);
            } else {
                return xVal < yVal ? 1 : (xVal > yVal ? -1 : 0);
            }
        };

        // Sort rows using the compare function
        rows.sort(compareRows);

        // Rebuild the tbody with sorted rows
        rows.forEach(row => tbody.appendChild(row));

        // Hide the progress bar after sorting is complete
        hideBlockingOverlay();
    }, 50);
}

// Click event to sort by each column
document.addEventListener('DOMContentLoaded', function() {
    // Select all <tr> rows inside the <thead>
    let rows = document.querySelectorAll("thead tr");

    // Loop through all the rows
    rows.forEach((row, rowIndex) => {
        // Select all <th> cells inside the current row
        let cells = row.querySelectorAll("th");

        // Loop through all the cells in the row
        cells.forEach((cell, cellIndex) => {
            cell.addEventListener("click", () => {
                // Call sortTable function when a header cell is clicked
                sortTable(cellIndex);
            });
        });
    });
});

///////////////////////////////////////////////////////////////////////
// Function to export the filtered/sorted table data to CSV
function exportTableToCSV() {
    let table = document.getElementById('dataTable');
    if (!table) {
        console.error("Table 'dataTable' not found");
        return;
    }

    let rows = table.getElementsByTagName('tr');
    let csvData = [];

    // Ensure we use only the first header row
    let headerRow = rows[0];

    // Create the CSV header from the first row (ignoring other header rows)
    let headerCells = headerRow.getElementsByTagName('th');
    let headerArray = [];
    for (let i = 0; i < headerCells.length; i++) {
		// Add the header text
        headerArray.push(headerCells[i].textContent.trim());
    }
	// Add the header to CSV
    csvData.push(headerArray.join(','));

    // Loop through the data rows, skipping the filter row (usually the second row)
	// Start from 1 to skip the header row
    for (let i = 1; i < rows.length; i++) {
        let row = rows[i];
		// Skip hidden rows after filtering
        if (row.style.display === 'none') continue;

        // Ensure the row has data cells (td)
        let cells = row.getElementsByTagName('td');
		// Skip rows that do not have data cells
        if (cells.length === 0) continue;

        let rowArray = [];

        // Collect data from visible cells
        for (let j = 0; j < cells.length; j++) {
            let cellValue = cells[j].textContent || cells[j].innerText;
			// Escape quotes
            rowArray.push('"' + cellValue.trim().replace(/"/g, '""') + '"');
        }

        // Add the row data to the CSV
        csvData.push(rowArray.join(','));
    }

    // Create a temporary link to download the CSV file
    let csvFile = new Blob([csvData.join('\n')], { type: 'text/csv' });
    let downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(csvFile);
    downloadLink.download = 'data.csv'; // CSV file name
    downloadLink.click();
}

// Event listener for the "Export CSV" button
document.addEventListener('DOMContentLoaded', function() {
    const exportButton = document.getElementById('export-csv-button');
    if (exportButton) {
        exportButton.addEventListener('click', function() {
            exportTableToCSV();
        });
    }
});

///////////////////////////////////////////////////////////////////////
// Function to show the blocking overlay
function showBlockingOverlay(message) {
    // Get the div element by its ID
    const overlay = document.getElementById("blocking-overlay");

    // Add the "show" class to make the overlay visible
    overlay.classList.add("show");

    // Set the provided message as the content of the div
    overlay.textContent = message;
}

// Function to hide the blocking overlay
function hideBlockingOverlay() {
    document.getElementById("blocking-overlay").classList.remove("show");
}

///////////////////////////////////////////////////////////////////////
// Function to toggle the stylesheet between "table_light.css" and "table_dark.css"
function toggleTheme() {
    // Retrieve the current theme setting
    let currentValue = getThemeSetting();
    // Convert the stored string to a boolean
    let isTrue = currentValue === 'true';
    // Invert the boolean value
    let newValue = !isTrue;
    // Store the new value
    setThemeSetting(newValue);

    // Call the function to apply the inverted theme
    html_tm_invert_theme();
}

// Function to switch between light and dark themes
function html_tm_invert_theme() {
    // Get all elements with the class "theme-style-sheet"
    const linkElements = document.getElementsByClassName("theme-style-sheet");

    // Iterate over each element with the class
    Array.from(linkElements).forEach(linkElement => {
        // Get the current href attribute value
        const currentHref = linkElement.getAttribute("href");

        // Extract the basePath from the current href
        // Finds the last "/" and takes the substring up to that point
        const basePath = currentHref.substring(0, currentHref.lastIndexOf("/") + 1);

        // Define the filenames for the light and dark themes
        const lightTheme = "table_light.css";
        const darkTheme = "table_dark.css";

        // Toggle between the light and dark themes
        if (currentHref === basePath + lightTheme) {
            // If the current theme is light, switch to dark
            linkElement.setAttribute("href", basePath + darkTheme);
        } else {
            // Otherwise, switch to light
            linkElement.setAttribute("href", basePath + lightTheme);
        }
    });
}

// Function to apply the theme when the page loads
function applyThemeOnLoad() {
    // Check the value stored in the theme setting
    let currentValue = getThemeSetting();
    // Convert the stored string to a boolean
    let isTrue = currentValue === 'true';

    // If the dark theme is enabled, apply the dark theme
    if (isTrue) {
        html_tm_invert_theme();
    }
}

// Apply the theme when the page loads
window.onload = applyThemeOnLoad;

// Helper function to set a cookie
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    // Add SameSite and Secure attributes
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=None; Secure";
}

// Helper function to get a cookie
function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// Function to detect if the browser is Firefox
function isFirefox() {
    return navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
}

// Function to get the theme setting (cookie or localStorage)
function getThemeSetting() {
    if (isFirefox()) {
        // Use cookies in Firefox
        return getCookie('html_tm_invert_theme');
    } else {
        // Use localStorage in other browsers
        return localStorage.getItem('html_tm_invert_theme');
    }
}

// Function to set the theme setting (cookie or localStorage)
function setThemeSetting(value) {
    if (isFirefox()) {
        // Use cookies in Firefox
        setCookie('html_tm_invert_theme', value, 365);
    } else {
        // Use localStorage in other browsers
        localStorage.setItem('html_tm_invert_theme', value);
    }
}

/*
Reason for choosing between localStorage and cookies:
- This application is designed to run using the `file://` protocol (local files).
- Based on tests executed with the default configurations of the browsers:
  - In Chromium-based browsers (like Chrome, Edge, Brave, etc.),
    `localStorage` works reliably with the `file://` protocol.
  - In Firefox, `localStorage` does not work reliably with `file://`,
    but cookies do.
Therefore, this approach ensures that the theme is stored and retrieved correctly
when the application is accessed via `file://`.
 */