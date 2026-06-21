import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const expectedSchema = process.env.APP_DATABASE_SCHEMA || "english_portal";

function assertEnglishPortalSchema() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error("DATABASE_URL is required before running seed.");
  }

  const parsed = new URL(rawUrl);
  const schema = parsed.searchParams.get("schema");
  if (schema !== expectedSchema) {
    throw new Error(`Refusing to seed schema '${schema ?? "public"}'; expected '${expectedSchema}'.`);
  }
}

async function main() {
  assertEnglishPortalSchema();

  await prisma.auditLog.deleteMany();
  await prisma.entitlement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productResource.deleteMany();
  await prisma.product.deleteMany();
  await prisma.aiFeedback.deleteMany();
  await prisma.writingSubmission.deleteMany();
  await prisma.aiPrompt.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.teacherLevel.deleteMany();
  await prisma.teacherProfile.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.level.deleteMany();

  const levels = await Promise.all([
    prisma.level.create({
      data: {
        code: "grade-2-3",
        name: "Story Builder",
        gradeBand: "Grade 2/3",
        description: "Complete sentences, paragraph foundations, creative story writing, and early EQAO-style preparation.",
        sortOrder: 1
      }
    }),
    prisma.level.create({
      data: {
        code: "grade-4-5-6",
        name: "Paragraph Builder",
        gradeBand: "Grade 4/5/6",
        description: "Paragraph structure, topic sentences, supporting details, five-paragraph essay foundations, and EQAO preparation.",
        sortOrder: 2
      }
    }),
    prisma.level.create({
      data: {
        code: "grade-7-8-9",
        name: "Essay Mastery",
        gradeBand: "Grade 7/8/9",
        description: "Persuasive and analytical essays, thesis development, research writing, and OSSLT-style timed writing.",
        sortOrder: 3
      }
    })
  ]);

  const [storyBuilder, paragraphBuilder, essayMastery] = levels;
  const passwordHash = await bcrypt.hash("Member123!", 12);

  const student = await prisma.user.create({
    data: {
      email: "student@example.com",
      passwordHash,
      firstName: "Asha",
      lastName: "Student",
      role: "STUDENT",
      student: { create: { levelId: essayMastery.id } }
    }
  });

  const teacher = await prisma.user.create({
    data: {
      email: "teacher@example.com",
      passwordHash,
      firstName: "Maya",
      lastName: "Teacher",
      role: "TEACHER",
      teacher: {
        create: {
          levels: {
            create: levels.map((level) => ({ levelId: level.id }))
          }
        }
      }
    }
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@example.com",
      passwordHash,
      firstName: "Jordan",
      lastName: "Admin",
      role: "ADMIN"
    }
  });

  await prisma.aiPrompt.create({
    data: {
      name: "iLEAP Writing Rubric Tutor",
      version: 1,
      isActive: true,
      editedById: admin.id,
      promptText:
        "You are an expert in English writing, grammar, and academic vocabulary. You are the iLEAP Academy AI Tutor for English writing and grammar. Review the student's writing and give a mark out of 10. Tell the student what the mistakes are and why they are mistakes. Give feedback under these exact sections: Content, Grammar & Punctuation, Academic Vocabulary, Structure, Good Transition Words, Overall. Be clear, encouraging, age-appropriate, and specific. Do not rewrite the full essay for the student."
    }
  });

  const essayTopic = await prisma.topic.create({
    data: {
      levelId: essayMastery.id,
      title: "Persuasive Essay Structure",
      description: "Plan thesis statements, body paragraphs, counterarguments, and conclusions.",
      sortOrder: 1,
      isPublished: true
    }
  });

  const paragraphTopic = await prisma.topic.create({
    data: {
      levelId: paragraphBuilder.id,
      title: "Strong Paragraphs",
      description: "Build topic sentences, supporting details, and closing sentences.",
      sortOrder: 1,
      isPublished: true
    }
  });

  const storyTopic = await prisma.topic.create({
    data: {
      levelId: storyBuilder.id,
      title: "Story Foundations",
      description: "Develop complete sentences and simple story structure.",
      sortOrder: 1,
      isPublished: true
    }
  });

  const [essayLesson, paragraphLesson, storyLesson] = await Promise.all([
    prisma.lesson.create({
      data: {
        topicId: essayTopic.id,
        title: "Week 1: Essay Structure",
        description: "Understand the parts of an essay and prepare a persuasive plan.",
        sortOrder: 1,
        isPublished: true
      }
    }),
    prisma.lesson.create({
      data: {
        topicId: paragraphTopic.id,
        title: "Week 1: Topic Sentences",
        description: "Write focused topic sentences and relevant supporting details.",
        sortOrder: 1,
        isPublished: true
      }
    }),
    prisma.lesson.create({
      data: {
        topicId: storyTopic.id,
        title: "Week 1: Story Ideas",
        description: "Practice complete sentences and simple story details.",
        sortOrder: 1,
        isPublished: true
      }
    })
  ]);

  const resources = await Promise.all([
    prisma.resource.create({
      data: {
        title: "Essay Structure Quick Guide",
        description: "A student-friendly overview of introduction, body paragraphs, and conclusion.",
        type: "PDF",
        accessMode: "LEVEL_ASSIGNED",
        levelId: essayMastery.id,
        topicId: essayTopic.id,
        lessonId: essayLesson.id,
        url: "https://example.com/essay-structure-guide.pdf",
        isPublished: true
      }
    }),
    prisma.resource.create({
      data: {
        title: "Paragraph Builder Worksheet",
        description: "Practice topic sentences, details, and closing sentences.",
        type: "WORKSHEET",
        accessMode: "LEVEL_ASSIGNED",
        levelId: paragraphBuilder.id,
        topicId: paragraphTopic.id,
        lessonId: paragraphLesson.id,
        url: "https://example.com/paragraph-builder-worksheet.pdf",
        isPublished: true
      }
    }),
    prisma.resource.create({
      data: {
        title: "Story Builder Video Lesson",
        description: "YouTube lesson link for building a simple story.",
        type: "VIDEO_LINK",
        accessMode: "FREE",
        levelId: storyBuilder.id,
        topicId: storyTopic.id,
        lessonId: storyLesson.id,
        url: "https://www.youtube.com/",
        isPublished: true
      }
    }),
    prisma.resource.create({
      data: {
        title: "Essay Mastery Workbook",
        description: "Paid workbook for Grade 7/8/9 essay practice.",
        type: "BOOK",
        accessMode: "INDIVIDUAL_PURCHASE",
        levelId: essayMastery.id,
        topicId: essayTopic.id,
        lessonId: essayLesson.id,
        url: "https://example.com/essay-mastery-workbook.pdf",
        isPublished: true
      }
    })
  ]);

  await prisma.assignment.createMany({
    data: [
      {
        title: "Persuasive Essay Practice",
        instructions: "Paste a persuasive essay about whether students should have daily reading time.",
        levelId: essayMastery.id,
        topicId: essayTopic.id,
        lessonId: essayLesson.id,
        isPublished: true
      },
      {
        title: "Strong Paragraph Practice",
        instructions: "Write one paragraph with a clear topic sentence, three details, and a closing sentence.",
        levelId: paragraphBuilder.id,
        topicId: paragraphTopic.id,
        lessonId: paragraphLesson.id,
        isPublished: true
      }
    ]
  });

  await prisma.product.create({
    data: {
      title: "Essay Mastery Workbook",
      description: "One-time purchase for the Grade 7/8/9 workbook.",
      type: "INDIVIDUAL",
      priceCents: 2900,
      levelId: essayMastery.id,
      resources: {
        create: [{ resourceId: resources[3].id }]
      }
    }
  });

  await prisma.entitlement.create({
    data: {
      userId: student.id,
      resourceId: resources[0].id,
      source: "LEVEL"
    }
  });

  console.log("Seed complete");
  console.log("Student login: student@example.com / Member123!");
  console.log("Teacher login: teacher@example.com / Member123!");
  console.log("Admin login: admin@example.com / Member123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
