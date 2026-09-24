/// <reference types="cypress" />

describe("03. Attendance & Schedules Module", () => {
  beforeEach(() => {
    cy.loginUI("ardhito@artacomindo.com", "password", "Narwasthu");
  });

  it("should load attendance history and statistics", () => {
    cy.visit("/dashboard/attendance");
    cy.url().should("include", "/dashboard/attendance");
    cy.get("main").should("be.visible");
  });

  it("should display live attendance monitoring", () => {
    cy.visit("/dashboard/live-attendance");
    cy.url().should("include", "/dashboard/live-attendance");
    cy.get("body").should("be.visible");
  });

  it("should display attendance map view", () => {
    cy.visit("/dashboard/attendance/map");
    cy.url().should("include", "/dashboard/attendance/map");
    cy.get("body").should("be.visible");
  });

  it("should display WFH attendance management", () => {
    cy.visit("/dashboard/attendance/wfh");
    cy.url().should("include", "/dashboard/attendance/wfh");
    cy.get("body").should("be.visible");
  });

  it("should display attendance correction requests", () => {
    cy.visit("/dashboard/attendance-corrections");
    cy.url().should("include", "/dashboard/attendance-corrections");
    cy.get("body").should("be.visible");
  });

  it("should display schedules calendar", () => {
    cy.visit("/dashboard/schedules");
    cy.url().should("include", "/dashboard/schedules");
    cy.get("body").should("be.visible");
  });

  it("should display shift swap requests", () => {
    cy.visit("/dashboard/shift-swap");
    cy.url().should("include", "/dashboard/shift-swap");
    cy.get("body").should("be.visible");
  });
});
