To set up a project: npm i

To fire up: node index.js <longppoll_api_key> <email_sender> <password_of_sender> <email_getter> <mail_service>

input_params.json file looks like:

[
    {
        "token": String,
        "sender": String,
        "password": String,
        "getter": String,
        "service": String,
        "vacancies": Path (String)
    }
]