mp.events.add('reditor:runServer', (player, code) => {
    try {
        eval(code);
    }catch(e){}
    player.call('reditor:runServerRes');
});

mp.events.add('reditor:runClients', (player, code) => {
    mp.players.forEach((player) => {
        player.call('reditor:runClientsEval', code);
    });
    player.call('reditor:runClientsRes');
});