import axios from 'axios'
import express from 'express'
const app = express()
const port = process.env.PORT || 3000

app.get('/', (req, res) => res.send('OK'))

const RETRY_INTERVAL = 5000
const MAX_RETRIES = 12

async function fetchEmails(auth) {
    return axios.get(
        "https://www.tempemail.cc/api/messages",
        {
            params: { limit: 10 },
            headers: {
                "Authorization": `Bearer ${auth}`,
                "Accept": "*/*",
                "Referer": "https://www.tempemail.cc/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
        }
    )
}

async function fetchEmailBody(auth, emailId) {
    const { data } = await axios.get(
        `https://www.tempemail.cc/api/messages/${emailId}`,
        {
            headers: {
                "Authorization": `Bearer ${auth}`,
                "Accept": "*/*",
                "Referer": "https://www.tempemail.cc/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
        }
    )
    return data.data
}

app.get('/getVerificationEmail', async (req, res) => {
    try {
        const { auth } = req.query
        console.log(auth)

        let latestEmail = null

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            console.log(`Attempt ${attempt}/${MAX_RETRIES}`)

            const response = await fetchEmails(auth)
            const browserlessEmails = response.data.data.items
                .filter((e) => e.from.name == 'APIFRAME' && e.subject == 'APIFRAME | Confirm Your Signup')
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

            if (browserlessEmails.length > 0) {
                latestEmail = browserlessEmails[0]
                console.log(latestEmail)

                const emailBody = await fetchEmailBody(auth, latestEmail.id)
                const match = emailBody.body.match(/<a\s+href="([^"]+)"[^>]*>Confirm Email<\/a>/)

                if (match) {
                    const verificationLink = match[1].replace(/&amp;/g, '&')
                    console.log(verificationLink)
                    res.send({ success: true, link: verificationLink })
                    return
                }
            }

            if (attempt < MAX_RETRIES) {
                console.log(`Email not found, retrying in ${RETRY_INTERVAL}ms...`)
                await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL))
            }
        }

        res.send({ success: false, error: 'Email not received after maximum retries' })
    } catch (error) {
        console.error(error)
        res.status(500).send({ success: false, error: error.message })
    }

})
app.listen(port, () => console.log(`Server running on port ${port}!`))