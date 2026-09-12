/// <reference types="cypress" />

describe("07. Organization, Access Control & System Settings", () => {
  beforeEach(() => {
    cy.loginUI("ardhito@artacomindo.com", "password", "Narwasthu");
  });

  it("should display company profile", () => {
    cy.visit("/dashboard/company");
    cy.url().should("include", "/dashboard/company");
    cy.get("main").should("be.visible");
  });

  it("should display offices and geofence locations", () => {
    cy.visit("/dashboard/offices");
    cy.url().should("include", "/dashboard/offices");
    cy.get("main").should("be.visible");
  });

  it("should display organization chart structure", () => {
    cy.visit("/dashboard/organization");
    cy.url().should("include", "/dashboard/organization");
    cy.get("main").should("be.visible");
  });

  it("should display roles and permissions matrix", () => {
    cy.visit("/dashboard/roles");
    cy.url().should("include", "/dashboard/roles");
    cy.get("main").should("be.visible");

    cy.visit("/dashboard/permissions");
    cy.url().should("include", "/dashboard/permissions");
    cy.get("main").should("be.visible");
  });

  it("should display activity logs and audit trail", () => {
    cy.visit("/dashboard/activity-logs");
    cy.url().should("include", "/dashboard/activity-logs");
    cy.get("main").should("be.visible");
  });

  it("should display WhatsApp notification gateway settings", () => {
    cy.visit("/dashboard/whatsapp");
    cy.url().should("include", "/dashboard/whatsapp");
    cy.get("main").should("be.visible");
  });
});
