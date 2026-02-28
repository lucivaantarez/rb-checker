export default {
  async fetch(request) {

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'X-Cookie',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      });
    }

    const cookie = request.headers.get('X-Cookie') || '';
    const CORS = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };
    const rbxCookie = '.ROBLOSECURITY=' + cookie;

    try {

      // 1. Auth check
      const authRes = await fetch(
        'https://users.roblox.com/v1/users/authenticated',
        { headers: { 'Cookie': rbxCookie } }
      );
      const auth = await authRes.json();

      if (auth.errors) {
        return new Response(
          JSON.stringify({ status: 'invalid' }),
          { headers: CORS }
        );
      }

      const userId = auth.id;
      const result = {
        status: 'valid',
        userId: userId,
        username: auth.name,
        displayName: auth.displayName,
        isBanned: auth.isBanned || false,
        presence: null,
        warned: false
      };

      if (auth.isBanned) {
        result.status = 'banned';
        return new Response(JSON.stringify(result), { headers: CORS });
      }

      // 2. Presence
      try {
        const presRes = await fetch(
          'https://presence.roblox.com/v1/presence/users',
          {
            method: 'POST',
            headers: {
              'Cookie': rbxCookie,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userIds: [userId] })
          }
        );
        const presData = await presRes.json();
        if (presData.userPresences && presData.userPresences[0]) {
          const p = presData.userPresences[0];
          const types = ['offline', 'online', 'ingame', 'studio'];
          result.presence = {
            type: types[p.userPresenceType] || 'offline',
            game: p.lastLocation || null,
            lastOnline: p.lastOnline || null
          };
        }
      } catch (e) {}

      // 3. Warn / restriction check
      try {
        const modRes = await fetch(
          'https://apis.roblox.com/account-restrictions/v1/restrictions',
          { headers: { 'Cookie': rbxCookie } }
        );
        if (modRes.ok) {
          const modData = await modRes.json();
          if (
            modData.gameContextRestrictionType &&
            modData.gameContextRestrictionType !== 'NoRestriction'
          ) {
            result.warned = true;
            result.status = 'warned';
            result.restrictionType = modData.gameContextRestrictionType;
          }
        }
      } catch (e) {}

      return new Response(JSON.stringify(result), { headers: CORS });

    } catch (e) {
      return new Response(
        JSON.stringify({ status: 'error', message: e.message }),
        { headers: CORS }
      );
    }
  }
}
