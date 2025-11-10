export function extractAuthFromUrl(url: any): {
    url: any;
    auth: {
        username?: undefined;
        password?: undefined;
    };
} | {
    url: any;
    auth: {
        username: any;
        password: any;
    };
};
