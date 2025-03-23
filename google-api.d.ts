declare namespace google {
    namespace auth {
        class OAuth2 {
            constructor(clientId: string, clientSecret: string, redirectUri: string);
            generateAuthUrl(options: any): string;
            getToken(code: string): Promise<any>;
            setCredentials(tokens: any): void;
        }
    }

    namespace drive {
        function drive(version: string): any;
    }
} 