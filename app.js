const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MySQL Connection Configuration
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'base',
    connectionLimit: 100
});

// Create necessary tables if not exists
async function initDatabase() {
    const connection = await pool.getConnection();
    try {
        // Feedback Responses Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS feedback_responses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                academic_year VARCHAR(10),
                year VARCHAR(10),
                semester VARCHAR(10),
                branch VARCHAR(50),
                section VARCHAR(10),
                teacher VARCHAR(100),
                subject VARCHAR(100),
                question_id INT,
                rating INT,
                college_comments TEXT,
                department_comments TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Feedback Summary Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS feedback_summary (
                academic_year VARCHAR(10),
                year VARCHAR(10),
                semester VARCHAR(10),
                branch VARCHAR(50),
                section VARCHAR(10),
                teacher VARCHAR(100),
                subject VARCHAR(100),
                question_id INT,
                total_responses INT,
                rating_6_count INT,
                rating_7_count INT,
                rating_8_count INT,
                rating_9_count INT,
                rating_10_count INT,
                total_percentage DECIMAL(5,2),
                college_comments TEXT,
                department_comments TEXT,
                PRIMARY KEY (academic_year, year, semester, branch, section, teacher, subject, question_id)
            )
        `);

        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    } finally {
        connection.release();
    }
}

// Submit Feedback Endpoint
app.post('/submit-feedback', async (req, res) => {
    const { 
        academicYear,
        year, 
        semester, 
        branch, 
        section, 
        feedbackData,
        collegeComments,
        departmentComments
    } = req.body;
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Insert individual responses
        for (const feedback of feedbackData) {
            await connection.query(
                'INSERT INTO feedback_responses (academic_year, year, semester, branch, section, teacher, subject, question_id, rating, college_comments, department_comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    academicYear,
                    year, 
                    semester, 
                    branch, 
                    section, 
                    feedback.teacher, 
                    feedback.subject, 
                    feedback.question_id, 
                    feedback.rating,
                    collegeComments,
                    departmentComments
                ]
            );
        }

        // Calculate and store summary
        const summaryQuery = `
            INSERT INTO feedback_summary 
            (academic_year, year, semester, branch, section, teacher, subject, question_id, 
            total_responses, rating_6_count, rating_7_count, rating_8_count, rating_9_count, rating_10_count, total_percentage,
            college_comments, department_comments)
            SELECT 
                ?, ?, ?, ?, ?, teacher, subject, question_id,
                COUNT(*) as total_responses,
                SUM(CASE WHEN rating = 6 THEN 1 ELSE 0 END) as rating_6_count,
                SUM(CASE WHEN rating = 7 THEN 1 ELSE 0 END) as rating_7_count,
                SUM(CASE WHEN rating = 8 THEN 1 ELSE 0 END) as rating_8_count,
                SUM(CASE WHEN rating = 9 THEN 1 ELSE 0 END) as rating_9_count,
                SUM(CASE WHEN rating = 10 THEN 1 ELSE 0 END) as rating_10_count,
                (SUM(rating) / (COUNT(*) * 10)) * 100 as total_percentage,
                GROUP_CONCAT(DISTINCT college_comments SEPARATOR '; ') as college_comments,
                GROUP_CONCAT(DISTINCT department_comments SEPARATOR '; ') as department_comments
            FROM feedback_responses
            WHERE academic_year = ? AND year = ? AND semester = ? AND branch = ? AND section = ?
            GROUP BY teacher, subject, question_id
            ON DUPLICATE KEY UPDATE 
                total_responses = VALUES(total_responses),
                rating_6_count = VALUES(rating_6_count),
                rating_7_count = VALUES(rating_7_count),
                rating_8_count = VALUES(rating_8_count),
                rating_9_count = VALUES(rating_9_count),
                rating_10_count = VALUES(rating_10_count),
                total_percentage = VALUES(total_percentage),
                college_comments = VALUES(college_comments),
                department_comments = VALUES(department_comments)
        `;

        await connection.query(summaryQuery, [
            academicYear, year, semester, branch, section,
            academicYear, year, semester, branch, section
        ]);

        await connection.commit();
        res.json({ message: 'Feedback submitted successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error submitting feedback:', error);
        res.status(500).json({ error: 'Failed to submit feedback', details: error.message });
    } finally {
        connection.release();
    }
});

// Retrieve Detailed Feedback Summary Endpoint
app.get('/detailed-feedback-summary', async (req, res) => {
    const { academicYear, year, semester, branch, section } = req.query;
    
    try {
        const [summaryResults] = await pool.query(
            `SELECT 
                academic_year,
                year,
                semester,
                branch,
                section,
                teacher,
                subject,
                question_id,
                total_responses,
                rating_6_count,
                rating_7_count,
                rating_8_count,
                rating_9_count,
                rating_10_count
             FROM feedback_summary 
             WHERE academic_year = ? 
             AND year = ? 
             AND semester = ? 
             AND branch = ? 
             AND section = ?
             ORDER BY teacher, subject, question_id`,
            [academicYear, year, semester, branch, section]
        );
        
        res.json(summaryResults);
    } catch (error) {
        console.error('Error retrieving detailed feedback summary:', error);
        res.status(500).json({ error: 'Failed to retrieve detailed feedback summary', details: error.message });
    }
});

// Retrieve Comments Endpoint
app.get('/feedback-comments', async (req, res) => {
    const { academicYear, year, semester, branch, section } = req.query;
    
    try {
        const [commentsResults] = await pool.query(
            'SELECT college_comments, department_comments FROM feedback_summary WHERE academic_year = ? AND year = ? AND semester = ? AND branch = ? AND section = ?',
            [academicYear, year, semester, branch, section]
        );
        
        res.json(commentsResults);
    } catch (error) {
        console.error('Error retrieving feedback comments:', error);
        res.status(500).json({ error: 'Failed to retrieve feedback comments', details: error.message });
    }
});

// Optional: Get Unique Teachers for a Specific Criteria
app.get('/teachers', async (req, res) => {
    const { academicYear, year, semester, branch, section } = req.query;
    
    try {
        const [teacherResults] = await pool.query(
            'SELECT DISTINCT teacher, subject FROM feedback_summary WHERE academic_year = ? AND year = ? AND semester = ? AND branch = ? AND section = ?',
            [academicYear, year, semester, branch, section]
        );
        
        res.json(teacherResults);
    } catch (error) {
        console.error('Error retrieving teachers:', error);
        res.status(500).json({ error: 'Failed to retrieve teachers', details: error.message });
    }
});

// Optional: Data Cleanup and Management Endpoints
app.delete('/clear-feedback-data', async (req, res) => {
    const { academicYear, year, semester, branch, section } = req.query;
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Delete from responses table
        await connection.query(
            'DELETE FROM feedback_responses WHERE academic_year = ? AND year = ? AND semester = ? AND branch = ? AND section = ?',
            [academicYear, year, semester, branch, section]
        );

        // Delete from summary table
        await connection.query(
            'DELETE FROM feedback_summary WHERE academic_year = ? AND year = ? AND semester = ? AND branch = ? AND section = ?',
            [academicYear, year, semester, branch, section]
        );

        await connection.commit();
        res.json({ message: 'Feedback data cleared successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error clearing feedback data:', error);
        res.status(500).json({ error: 'Failed to clear feedback data', details: error.message });
    } finally {
        connection.release();
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!', 
        message: err.message 
    });
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log('Feedback Management System Backend is ready');
    });
}).catch(error => {
    console.error('Failed to initialize database:', error);
});

// Export for potential testing or module usage
module.exports = app;