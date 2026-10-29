const RESUME_LIMIT = 5 * 1024 * 1024;
const RESUME_TYPES = new Map([
    ['.pdf', 'application/pdf'],
    ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
]);

function validateResume(file) {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
        return { valid: false, error: 'Attach a PDF or DOCX resume.' };
    }
    if (file.buffer.length > RESUME_LIMIT) {
        return { valid: false, error: 'Resume files must be 5 MB or smaller.' };
    }

    const filename = typeof file.originalname === 'string' ? file.originalname : '';
    const extension = filename.toLowerCase().slice(filename.lastIndexOf('.'));
    const expectedType = RESUME_TYPES.get(extension);
    if (!expectedType || file.mimetype !== expectedType) {
        return { valid: false, error: 'Only PDF and DOCX resumes are accepted.' };
    }

    const signatureIsValid = extension === '.pdf'
        ? file.buffer.subarray(0, 5).toString('ascii') === '%PDF-'
        : file.buffer.length >= 4
            && file.buffer[0] === 0x50
            && file.buffer[1] === 0x4b
            && [0x03, 0x05, 0x07].includes(file.buffer[2])
            && [0x04, 0x06, 0x08].includes(file.buffer[3])
            && file.buffer.includes(Buffer.from('[Content_Types].xml'))
            && file.buffer.includes(Buffer.from('word/document.xml'));
    if (!signatureIsValid) {
        return { valid: false, error: 'The file content does not match its file type.' };
    }

    return {
        valid: true,
        value: {
            name: `resume${extension}`,
            type: expectedType,
            data: file.buffer
        }
    };
}

module.exports = { RESUME_LIMIT, validateResume };
