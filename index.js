const loadJsonFile = require('load-json-file');
const path = require('path')
const fetch = require('node-fetch');
const archiver = require('archiver');
const fs = require('fs');
var request = require('request');
var FormData = require('form-data');
const easyvk = require('easyvk');
const rest = require('restler');

const vacancies = require('./vacancies.json');
const api_key = '1563de6cd1bea098b9af47d563ea8963dabb65c8441a7e786912f1d1452825906f57c545a7e02ab46a4df'


const VkBot = require('node-vk-bot-api');
const Markup = require('node-vk-bot-api/lib/markup');
const { format } = require('path');

const bot = new VkBot(api_key);

bot.command(['/start', 'Начать', 'start', 'Start', 'начать', 'Старт', 'старт'], (ctx) => {
    ctx.reply('Если хочешь, я расскажу про вакансии.', null, Markup
        .keyboard([
            Markup.button({
                action: {
                    type: 'text',
                    label: 'Хочу посмотреть открытые вакансии!',
                    payload: JSON.stringify({
                        button: 'act1',
                    }),
                },
                color: 'primary',
            }),
            Markup.button({
                action: {
                    type: 'text',
                    label: 'Хочу поболтать с менеджером!',
                    payload: JSON.stringify({
                        button: 'act2',
                    }),
                },
                color: 'primary',
            }),
        ], { columns: 1 }).oneTime());
});

const form = {}

bot.command('Хочу поболтать с менеджером!', async ctx => {

    try {
        easyvk({
            token: '1563de6cd1bea098b9af47d563ea8963dabb65c8441a7e786912f1d1452825906f57c545a7e02ab46a4df',
            utils: {
                longpoll: true
            }
        }).then(async vk => {

            const lpSettings = {
                forGetLongPollServer: {
                    lp_version: 3, // Изменяем версию LongPoll, в EasyVK используется версия 2
                    need_pts: 1
                },
                forLongPollServer: {
                    wait: 15 // Ждем ответа 15 секунд
                }
            }

            async function getMessage(msgArray = []) {
                const MESSAGE_ID__INDEX = 1;

                return vk.call('messages.getById', {
                    message_ids: msgArray[MESSAGE_ID__INDEX]
                })
            }

            async function sendMessageToManager(user, random, peer, mess) {
                return vk.call("messages.send", {
                    user_id: user,
                    random_id: random,
                    peer_id: peer,
                    message: mess
                })
            }

            const random = (min, max) => Math.floor(Math.random() * (max - min)) + min;

            vk.longpoll.connect(lpSettings).then((lpcon) => {
                let flag = true;
                lpcon.on("message", async (msg) => {
                    let fullMessage = await getMessage(msg);
                    fullMessage = fullMessage.items[0]
                    while (flag) {
                        await sendMessageToManager(392828943, random(1, 100000), 392828943, "Пользователь https://vk.com/id" + fullMessage.peer_id.toString() + " хочет пообщаться с менеджером по поводу вакансий.")
                        flag = false
                    }
                })
            })
        })
        await ctx.reply('Я передала твою страницу ВК менеджеру, он обязательно тебе ответит!');
    } catch (e) {
        console.error(e);
    }
});

bot.command('Хочу посмотреть открытые вакансии!', async (ctx) => {
    let obj = loadJsonFile.sync('./vacancies.json');

    let varArr = [];

    let fullArr = [];

    for (let i = 0; i < obj.length; i++) {

        fullArr.push({
            id: obj[i].id,
            name: obj[i].name,
            is_reserve: obj[i].is_reserve,
            files: obj[i].files ? obj[i].files : null
        })

        if (obj[i].is_reserve == false) {
            varArr.push(
                Markup.button({
                    action: {
                        type: 'text', // Тип кнопки
                        label: obj[i].name, // Текст
                        payload: JSON.stringify({
                            button: 'act3',
                        }),
                    },
                    color: 'primary', // цвет текста
                })
            )

        }
        console.log(obj[i].name)
    }

    varArr.push(
        Markup.button({
            action: {
                type: 'text', // Тип кнопки
                label: 'Я пас.', // Текст
                payload: JSON.stringify({
                    button: 'wer', // Полезная нагрузка на кнопку при нажатии её, вк будет передавать этот текст
                }),
            },
            color: 'negative', // цвет текста
        })
    )

    for (let i = 0; i < fullArr.length; i++) {
        bot.command(fullArr[i].name.toString(), async ctx => {

            try {
                let buff = Buffer.from(fullArr[i].files[0].content.toString(), 'base64');
                fs.writeFile(fullArr[i].files[0].file_name.toString(), buff, async function (error) {
                    if (error) throw error; // если возникла ошибка
                    let data = fs.readFileSync(fullArr[i].files[0].file_name.toString(), "utf8");

                    easyvk({
                        token: '1563de6cd1bea098b9af47d563ea8963dabb65c8441a7e786912f1d1452825906f57c545a7e02ab46a4df',
                        utils: {
                            longpoll: true,
                            uploader: true
                        }
                    }).then(async vk => {

                        const lpSettings = {
                            forGetLongPollServer: {
                                lp_version: 3, // Изменяем версию LongPoll, в EasyVK используется версия 2
                                need_pts: 1
                            },
                            forLongPollServer: {
                                wait: 15 // Ждем ответа 15 секунд
                            }
                        }

                        async function getMessage(msgArray = []) {
                            const MESSAGE_ID__INDEX = 1;

                            return vk.call('messages.getById', {
                                message_ids: msgArray[MESSAGE_ID__INDEX]
                            })
                        }

                        async function uploadServerGet(peer_id) {
                            return vk.call("docs.getMessagesUploadServer", {
                                type: "doc",
                                peer_id: peer_id,
                            })
                        }

                        async function saveDoc(file) {
                            return vk.call("docs.save", {
                                file: file,
                                title: fullArr[i].files[0].file_name.toString().split(".")[0] + ".zip",
                                tags: "test_tag",
                                return_tags: 1
                            })
                        }

                        vk.longpoll.connect(lpSettings).then((lpcon) => {
                            let flag = true;
                            lpcon.on("message", async (msg) => {
                                let fullMessage = await getMessage(msg);
                                fullMessage = fullMessage.items[0]
                                console.log(fullArr[i].files[0].file_name.toString())
                                while (flag) {
                                    const serv = await uploadServerGet(fullMessage.peer_id)

                                    const field = 'doc'
                                    const url = serv.upload_url;
                                    const me = fullMessage.peer_id;
                                    const server = vk.uploader;
                                    const output = fs.createWriteStream('./' + fullArr[i].files[0].file_name.toString().split(".")[0] + ".zip");
                                    const archive = archiver('zip', {
                                        zlib: { level: 3 } // Sets the compression level.
                                    });
                                    output.on('close', function () {
                                        console.log(archive.pointer() + ' total bytes');
                                        console.log('archiver has been finalized and the output file descriptor has closed.');
                                    });
                                    output.on('end', function () {
                                        console.log('Data has been drained');
                                    });
                                    archive.on('warning', function (err) {
                                        if (err.code === 'ENOENT') {
                                            // log warning
                                        } else {
                                            // throw error
                                            throw err;
                                        }
                                    });

                                    // good practice to catch this error explicitly
                                    archive.on('error', function (err) {
                                        throw err;
                                    });

                                    if (fullArr[i].files[0].file_name.split(".")[1].includes("doc")) {
                                        server.upload({
                                            getUrlMethod: "docs.getMessagesUploadServer",
                                            getUrlParams: {
                                                type: "doc",
                                                peer_id: me,
                                            },
                                            saveMethod: "docs.save",
                                            saveParams: {
                                                file: url,
                                                title: fullArr[i].files[0].file_name.toString(),
                                                tags: "no_tags",
                                                return_tags: 0
                                            },
                                            file: fullArr[i].files[0].file_name.toString(),
                                        }).then(res => {
                                            console.log(res.doc.url)
                                        })
                                    } else {
                                        archive.pipe(output);
                                        const file1 = './' + fullArr[i].files[0].file_name;
                                        archive.append(fs.createReadStream(file1), { name: fullArr[i].files[0].file_name.toString() });
                                        archive.finalize();

                                        server.upload({
                                            getUrlMethod: "docs.getMessagesUploadServer",
                                            getUrlParams: {
                                                type: "doc",
                                                peer_id: me,
                                            },
                                            saveMethod: "docs.save",
                                            saveParams: {
                                                file: url,
                                                title: fullArr[i].files[0].file_name.toString().split(".")[0] + ".zip",
                                                tags: "no_tags",
                                                return_tags: 0
                                            },
                                            file: fullArr[i].files[0].file_name.toString().split(".")[0] + ".zip",
                                        }).then(res => {
                                            console.log(res.doc.url)
                                        })
                                    }

                                    flag = false
                                }
                            })
                        })


                        // vk.longpoll.connect(lpSettings).then((lpcon) => {
                        //     let flag = true;
                        //     lpcon.on("message", async (msg) => {
                        //         let fullMessage = await getMessage(msg);
                        //         fullMessage = fullMessage.items[0]
                        //         while(flag)
                        //         {
                        //             await sendMessageToManager(392828943, easyvk.randomId(), 392828943, "Пользователь https://vk.com/id" + fullMessage.peer_id.toString() + " хочет пообщаться с менеджером по поводу вакансий.")
                        //             flag = false
                        //         }
                        //     })
                        // })
                    })

                    await ctx.reply("Вот информация о вакансии.", fullArr[i].files[0].file_name.toString());
                });

            } catch (e) {
                //   console.error(e);
            }
        });
    }

    try {
        await ctx.reply('Класс! Вот наши вакансии, выбирай понравившуюся :)', null, Markup
            .keyboard(varArr, { columns: 1 }).oneTime(true));
    } catch (e) {
        console.error(e);
    }

});

bot.startPolling();