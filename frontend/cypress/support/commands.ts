/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Custom command to establish authenticated session
     */
    loginUI(email?: string, password?: string, companyName?: string): Chainable<void>;

    /**
     * Custom command to log in via API request and set auth cookies
     */
    loginAPI(email?: string, password?: string, companyName?: string): Chainable<any>;

    /**
     * Check if navigation and header exist
     */
    checkDashboardHeader(): Chainable<void>;
  }
}

Cypress.Commands.add("loginUI", (
  email = "ardhito@artacomindo.com",
  password = "password",
  companyName = "Narwasthu Artha Tama (Artacomindo Group)"
) => {
  cy.session(
    `user-${email}`,
    () => {
      cy.request({
        method: "POST",
        url: "http://127.0.0.1:8000/api/login",
        body: {
          email,
          password,
          company_name: companyName,
        },
      }).then((response) => {
        const data = response.body?.data;
        if (data && data.access_token) {
          cy.setCookie("token", data.access_token);
          if (data.refresh_token) {
            cy.setCookie("refresh_token", data.refresh_token);
          }
        }
      });
    }
  );
});

Cypress.Commands.add("checkDashboardHeader", () => {
  cy.get("aside, nav", { timeout: 10000 }).should("be.visible");
});
