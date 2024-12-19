document.addEventListener('DOMContentLoaded', () => {
    const yearSelect = document.getElementById('year');
    const semesterSelect = document.getElementById('semester');
    const branchSelect = document.getElementById('branch');
    const sectionSelect = document.getElementById('section');
    const academicYearInput = document.createElement('input');
    const fetchButton = document.getElementById('fetchButton');
    const feedbackResults = document.getElementById('feedbackResults');

    // Configure academic year input
    academicYearInput.type = 'text';
    academicYearInput.id = 'academicYear';
    academicYearInput.placeholder = 'Enter Academic Year (YYYY-YYYY)';
    academicYearInput.pattern = '^\d{4}-\d{4}$';
    academicYearInput.required = true;

    // Insert academic year input before first select
    const filterSection = document.querySelector('.filter-section');
    const academicYearLabel = document.createElement('label');
    academicYearLabel.textContent = 'Academic Year: ';
    academicYearLabel.appendChild(academicYearInput);
    filterSection.insertBefore(academicYearLabel, filterSection.firstChild);

    // Create Print All button
    const printAllButton = document.createElement('button');
    printAllButton.textContent = 'Print All Tables';
    printAllButton.id = 'printAllButton';
    printAllButton.style.cssText = 'padding: 10px; background-color: #28a745; color: white; border: none; border-radius: 4px; margin-left: 10px; cursor: pointer;';
    printAllButton.style.display = 'none'; // Initially hidden
    filterSection.appendChild(printAllButton);

    fetchButton.addEventListener('click', fetchFeedbackSummary);
    printAllButton.addEventListener('click', printAllTables);

    async function fetchFeedbackSummary() {
        // Validate all selections
        if (!academicYearInput.value || !yearSelect.value || 
            !semesterSelect.value || !branchSelect.value || 
            !sectionSelect.value) {
            alert('Please select all filter options and enter academic year');
            return;
        }

        try {
            const response = await fetch(`http://localhost:3000/detailed-feedback-summary?` + 
                `academicYear=${academicYearInput.value}&` +
                `year=${yearSelect.value}&` +
                `semester=${semesterSelect.value}&` +
                `branch=${branchSelect.value}&` +
                `section=${sectionSelect.value}`
            );

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            renderDetailedFeedbackSummary(data);
        } catch (error) {
            console.error('Error fetching detailed feedback:', error);
            feedbackResults.innerHTML = `<p>Error fetching feedback: ${error.message}</p>`;
        }
    }

    function renderDetailedFeedbackSummary(data) {
        // Check if data is empty
        if (!data || data.length === 0) {
            feedbackResults.innerHTML = '<p>No feedback data found.</p>';
            return;
        }

        // Group data by teacher and subject
        const groupedData = {};
        data.forEach(item => {
            const key = `${item.teacher}_${item.subject}`;
            if (!groupedData[key]) {
                groupedData[key] = {};
            }
            groupedData[key][item.question_id] = item;
        });

        // Create HTML for results
        let htmlContent = '';
        
        Object.entries(groupedData).forEach(([key, questionData]) => {
            const [teacher, subject] = key.split('_');
            
            // Calculate individual question percentages and question scores
            const questionCalculations = Object.entries(questionData).map(([qId, qData]) => {
                const percentage = calculateQuestionPercentage(qData);
                const score = calculateQuestionScore(qData);
                return {
                    qId, 
                    percentage, 
                    score
                };
            });

            // Calculate total percentages and scores
            const percentageSum = questionCalculations.reduce((sum, calc) => sum + calc.percentage, 0);
            const scoreSum = questionCalculations.reduce((sum, calc) => sum + calc.score, 0);

            // Prepare table for this teacher-subject combination
            htmlContent += `
                <div class="feedback-table-container" style="margin-bottom: 20px; position: relative;">
                    <table class="feedback-table print-table" style="width:100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #f2f2f2;">
                                <th colspan="2" style="text-align: left; padding: 10px; border: 1px solid #ddd;">
                                    Academic Year: ${academicYearInput.value} | 
                                    Year: ${yearSelect.value} | 
                                    Semester: ${semesterSelect.value} | 
                                    Branch: ${branchSelect.value} | 
                                    Section: ${sectionSelect.value} | 
                                    Teacher: ${teacher} | 
                                    Subject: ${subject}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 5px;">Total Responses</td>
                                <td style="border: 1px solid #ddd; padding: 5px;">
                                    ${Object.values(questionData)[0].total_responses || 0}
                                </td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 5px;">Sum of Each Question Scores</td>
                                <td style="border: 1px solid #ddd; padding: 5px;">
                                    ${questionCalculations.map(calc => `Q${calc.qId}: ${calc.score.toFixed(2)}`).join(' | ')} | Total: ${scoreSum.toFixed(2)}
                                </td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 5px;">Question-wise Percentage</td>
                                <td style="border: 1px solid #ddd; padding: 5px;">
                                    ${questionCalculations.map(calc => `Q${calc.qId}: ${calc.percentage.toFixed(2)}%`).join(' | ')} | Total: ${percentageSum.toFixed(2)}%
                                </td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 5px;">Total Average Percentage</td>
                                <td style="border: 1px solid #ddd; padding: 5px;">
                                    ${calculateTotalPercentage(questionData).toFixed(2)}%
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        });

        // Render content
        feedbackResults.innerHTML = htmlContent;

        // Show Print All button if tables are present
    }

    function printAllTables() {
        // Create a new window for printing
        const printWindow = window.open('', '', 'width=800,height=600');
        
        // Collect all tables
        const tables = document.querySelectorAll('.print-table');
        
        // Prepare HTML for printing
        let printContent = `
            <html>
                <head>
                    <title>Feedback Summary - All Tables</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            margin: 0;
                            padding: 20px;
                        }
                        table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            margin-bottom: 20px; 
                            page-break-after: always;
                        }
                        th, td { 
                            border: 1px solid #ddd; 
                            padding: 10px; 
                            text-align: left; 
                            font-size:10px;
                        }
                        th { 
                            background-color: #f2f2f2; 
                        }
                        @media print {
                            table {
                                page-break-after: always;
                            }
                            table:last-child {
                                page-break-after: avoid;
                            }
                        }
                    </style>
                </head>
                <body>
        `;

        // Add each table to the print content
        tables.forEach(table => {
            printContent += table.outerHTML;
        });

        printContent += `
                </body>
            </html>
        `;
        
        // Write content to print window
        printWindow.document.write(printContent);
        
        // Close the document for printing
        printWindow.document.close();
        
        // Trigger print dialog
        printWindow.print();
    }

    function calculateQuestionPercentage(questionData) {
        const ratingCounts = [
            questionData.rating_6_count || 0,
            questionData.rating_7_count || 0,
            questionData.rating_8_count || 0,
            questionData.rating_9_count || 0,
            questionData.rating_10_count || 0
        ];

        const totalRatings = ratingCounts.reduce((sum, count) => sum + count, 0);
        const weightedSum = ratingCounts.reduce((sum, count, index) => sum + count * (index + 6), 0);

        return totalRatings > 0 ? (weightedSum / (totalRatings * 10)) * 100 : 0;
    }

    function calculateQuestionScore(questionData) {
        const ratingCounts = [
            questionData.rating_6_count || 0,
            questionData.rating_7_count || 0,
            questionData.rating_8_count || 0,
            questionData.rating_9_count || 0,
            questionData.rating_10_count || 0
        ];

        return ratingCounts.reduce((sum, count, index) => sum + count * (index + 6), 0);
    }

    function calculateTotalPercentage(questionData) {
        const percentages = Object.values(questionData).map(calculateQuestionPercentage);
        return percentages.reduce((sum, percentage) => sum + percentage, 0) / percentages.length;
    }
});