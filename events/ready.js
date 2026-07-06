export default {
    name: 'clientReady',
    once: true,

    async execute(client) {
        console.log(`Logged in as ${client.user.tag}`);

        const updatePresence = () => {
            const guilds = client.guilds.cache;
            const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);

            const list = [
                { name: `over ${totalMembers} members`, type: 3 },
                { name: `sad`, type: 0 },
                { name: `Smorii Systems`, type: 2 }
            ];

            const res = list[Math.floor(Math.random() * list.length)];

            client.user.setPresence({
                activities: [{
                    name: res.name,
                    type: res.type
                }],
                status: 'online'
            });
        };

        updatePresence();

        setInterval(updatePresence, 15000);
    }
};